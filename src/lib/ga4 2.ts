/**
 * Tracking Google Analytics 4 côté navigateur.
 *
 * STRATÉGIE (différente de meta.ts, pour une raison précise) : Meta
 * dédoublonne nativement deux événements qui partagent le même event_id —
 * GA4 ne fait rien de tel pour des événements génériques (page_view,
 * view_item…). Envoyer systématiquement par les deux chemins comme pour Meta
 * compterait donc chaque événement EN DOUBLE dès que gtag.js charge. On
 * revient ici à l'aiguillage de klaviyo.ts : chaque événement part par UN
 * SEUL chemin, décidé par le succès ou l'échec du chargement de gtag.js —
 * jamais les deux.
 *  - gtag.js charge (script onload) → il gère tout lui-même, aucun relais ;
 *  - gtag.js bloqué (script onerror, cas des bloqueurs de contenu qui
 *    bloquent googletagmanager.com/google-analytics.com) → relais
 *    first-party /api/ga4-events (même domaine, non bloqué) prend le relais
 *    pour TOUS les événements de cette page.
 *  - Le temps que le script se charge (état encore inconnu), les appels
 *    passent par la file gtag (traités si le script charge) ET sont mis de
 *    côté ; s'il s'avère bloqué, ils sont rejoués vers le relais à ce
 *    moment-là seulement — jamais les deux à la fois.
 *
 * Le Purchase n'a PAS de chemin client : le checkout se passe hors domaine
 * (checkout Shopify / shop.app), capté côté serveur par le webhook
 * orders/paid (src/pages/api/webhooks/shopify-orders.ts). Le cookie _ga est
 * posé en attribut de panier (voir cart.ts) pour revenir dans ce webhook et
 * rattacher la vente au bon client_id.
 *
 * Tout est inerte tant que PUBLIC_GA4_MEASUREMENT_ID n'est pas défini.
 */

const MEASUREMENT_ID = import.meta.env.PUBLIC_GA4_MEASUREMENT_ID as string | undefined;

const GA_COOKIE = "_ga";
const GA_CLIENT_ID_STORAGE_KEY = "maison-reflet:ga4ClientId";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

// ---------- Cookies & client_id ----------

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
  } catch {
    // cookies bloqués : le repli localStorage prend le relais
  }
}

let memoryClientId: string | null = null;

/**
 * client_id GA4 : les deux derniers segments du cookie _ga
 * (GA1.1.{aléa}.{timestamp}). Posé par gtag.js quand il charge ; quand il
 * est bloqué, on le génère nous-mêmes au même format pour que le
 * Measurement Protocol garde un identifiant stable — et on pose le cookie
 * pour qu'un gtag.js qui chargerait plus tard adopte le même id (évite de
 * scinder l'identité en deux profils GA4 distincts).
 */
function getOrCreateGa4ClientId(): string | null {
  const existing = readCookie(GA_COOKIE);
  if (existing) {
    const parts = existing.split(".");
    if (parts.length >= 4) return parts.slice(-2).join(".");
  }

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(GA_CLIENT_ID_STORAGE_KEY);
  } catch {
    // localStorage indisponible
  }
  const clientId =
    stored ??
    memoryClientId ??
    `${Math.floor(Math.random() * 2147483647)}.${Math.floor(Date.now() / 1000)}`;

  memoryClientId = clientId;
  writeCookie(GA_COOKIE, `GA1.1.${clientId}`, 2 * 365 * 24 * 60 * 60); // 2 ans, durée standard du cookie _ga
  try {
    localStorage.setItem(GA_CLIENT_ID_STORAGE_KEY, clientId);
  } catch {
    // replis cookie + mémoire
  }
  return clientId;
}

/**
 * client_id pour les attributs de panier Shopify (cart.ts). Null si le
 * tracking GA4 est désactivé — aucun id n'est alors généré.
 */
export function getGa4ClientId(): string | null {
  if (!MEASUREMENT_ID) return null;
  return getOrCreateGa4ClientId();
}

// ---------- gtag.js (chemin navigateur) + aiguillage ----------

// null = pas encore su si gtag.js a chargé ; false = chargé (il gère tout
// lui-même) ; true = bloqué (relais pour tout le reste de la page).
let gtagBlocked: boolean | null = null;
const pendingEvents: { eventName: string; params: Record<string, unknown> }[] = [];

function injectGtagStub() {
  if (window.gtag) {
    gtagBlocked = false;
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.onload = () => {
    gtagBlocked = false;
  };
  script.onerror = () => {
    gtagBlocked = true;
    // Rejoue vers le relais tout ce qui a été mis de côté pendant l'incertitude.
    for (const e of pendingEvents) sendToRelay(e.eventName, e.params);
    pendingEvents.length = 0;
  };
  document.head.appendChild(script);
}

// ---------- Relais serveur (chemin first-party, insensible aux bloqueurs) ----------

function sendToRelay(eventName: string, params: Record<string, unknown>) {
  const body = JSON.stringify({
    eventName,
    clientId: getOrCreateGa4ClientId(),
    sourceUrl: window.location.href,
    params,
  });
  try {
    // sendBeacon survit à la navigation (checkout, fermeture d'onglet)
    if (!navigator.sendBeacon?.("/api/ga4-events", new Blob([body], { type: "application/json" }))) {
      fetch("/api/ga4-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // best effort
  }
}

// ---------- API publique ----------

/**
 * Envoie un événement par UN SEUL chemin (jamais les deux — voir
 * l'aiguillage en tête de fichier). Best effort, jamais bloquant.
 */
export function trackGa4(eventName: string, params: Record<string, unknown> = {}) {
  if (!MEASUREMENT_ID) return;

  if (gtagBlocked === true) {
    sendToRelay(eventName, params);
    return;
  }

  // gtagBlocked === false (chargé) ou null (encore incertain) : passe par
  // gtag.js — sans risque, c'est une simple file locale tant que le script
  // réel n'a pas pris le relais. Si l'incertitude se résout en "bloqué"
  // plus tard, l'événement est rejoué vers le relais (voir onerror).
  try {
    window.gtag?.("event", eventName, params);
  } catch {
    // le tracking ne doit jamais faire échouer la page
  }
  if (gtagBlocked === null) {
    pendingEvents.push({ eventName, params });
  }
}

/**
 * À appeler au chargement de chaque page (voir Layout.astro) : injecte
 * gtag.js et configure le client_id. send_page_view désactivé — le
 * page_view part via trackGa4() comme tout le reste, pour bénéficier du
 * même aiguillage (sinon gtag.js enverrait son propre page_view automatique
 * sans jamais passer par le relais en cas de blocage tardif).
 */
export function initGa4() {
  if (!MEASUREMENT_ID) return;
  try {
    injectGtagStub();
    window.gtag?.("js", new Date());
    window.gtag?.("config", MEASUREMENT_ID, {
      client_id: getOrCreateGa4ClientId(),
      send_page_view: false,
    });
    trackGa4("page_view", { page_location: window.location.href, page_title: document.title });
  } catch {
    // best effort
  }
}

// ---------- Helpers e-commerce (formes standard GA4) ----------

/** "gid://shopify/ProductVariant/4323…" → "4323…" */
export function shopifyNumericId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export type Ga4Item = { item_id: string; item_name: string; price: number; quantity?: number };

/** view_item — page produit ou coffret. */
export function ga4ViewItem(data: { item: Ga4Item; value: number; currency: string }) {
  trackGa4("view_item", { currency: data.currency, value: data.value, items: [data.item] });
}

/** add_to_cart — lignes réellement ajoutées (pas le panier entier). */
export function ga4AddToCart(data: { items: Ga4Item[]; value: number; currency: string }) {
  if (!data.items.length) return;
  trackGa4("add_to_cart", { currency: data.currency, value: data.value, items: data.items });
}

/** begin_checkout — au clic sur le bouton checkout du panier. */
export function ga4BeginCheckout(data: { items: Ga4Item[]; value: number; currency: string }) {
  trackGa4("begin_checkout", { currency: data.currency, value: data.value, items: data.items });
}
