/**
 * Tracking Meta (Facebook) Pixel côté navigateur — envoi en double flux.
 *
 * STRATÉGIE (différente de klaviyo.ts, pour une raison précise) :
 * Meta dédoublonne nativement les paires navigateur/serveur qui partagent le
 * même couple (event_name, event_id). Chaque événement part donc TOUJOURS par
 * les deux chemins à la fois :
 *  - fbq() (Pixel navigateur) — bloqué par les bloqueurs de contenu, mais
 *    quand il passe, il porte le cookie _fbp/_fbc natif et le contexte page ;
 *  - relais first-party /api/meta-events (même domaine, non bloqué) qui
 *    transmet à la Conversions API avec le même event_id.
 * Si le Pixel est bloqué, seul le flux serveur arrive : couverture totale.
 * Si les deux arrivent, Meta n'en garde qu'un : jamais de doublon.
 *
 * À la différence de klaviyo.js (proxy inerte tant que le script n'a pas
 * chargé, cf. klaviyo.ts), le stub fbq officiel EST une file : les appels
 * émis avant le chargement de fbevents.js sont mis en queue et rejoués.
 * Pas besoin de calendrier de ré-émission ici.
 *
 * L'événement Purchase n'a PAS de chemin client : le checkout se passe hors
 * domaine (checkout Shopify / shop.app), il est capté côté serveur par le
 * webhook orders/paid (src/pages/api/webhooks/shopify-orders.ts). Les cookies
 * _fbp/_fbc sont posés en attributs de panier (voir cart.ts) pour revenir
 * dans ce webhook et rattacher l'achat au clic publicitaire d'origine.
 *
 * Tout est inerte tant que PUBLIC_META_PIXEL_ID n'est pas défini.
 */

import { getIdentifiedEmail } from "./klaviyo";

const PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID as string | undefined;

const EXTERNAL_ID_KEY = "maison-reflet:metaExternalId";
const FBP_COOKIE = "_fbp";
const FBC_COOKIE = "_fbc";
const FBP_STORAGE_KEY = "maison-reflet:metaFbp"; // repli si les cookies sont bloqués

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

// ---------- Cookies & identifiants navigateur ----------

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

// Repli mémoire (cookies ET localStorage bloqués) : l'id survit le temps de
// la page au lieu d'être régénéré à chaque appel — même posture que
// memoryEmail (klaviyo.ts) et memoryCartId (cart.ts).
let memoryFbp: string | null = null;

/**
 * _fbp : identifiant navigateur stable de Meta (format fb.1.{ms}.{aléa}).
 * Le Pixel le pose lui-même quand il charge ; quand il est bloqué, on le
 * génère nous-mêmes au même format (autorisé et documenté par Meta) pour que
 * la Conversions API garde un identifiant stable — et on le pose en cookie
 * pour qu'un Pixel qui chargerait plus tard adopte le même id.
 */
function getOrCreateFbp(): string | null {
  const existing = readCookie(FBP_COOKIE);
  if (existing) return existing;

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(FBP_STORAGE_KEY);
  } catch {
    // localStorage indisponible
  }
  const fbp = stored ?? memoryFbp ?? `fb.1.${Date.now()}.${Math.floor(Math.random() * 2147483647)}`;

  memoryFbp = fbp;
  writeCookie(FBP_COOKIE, fbp, 90 * 24 * 60 * 60);
  try {
    localStorage.setItem(FBP_STORAGE_KEY, fbp);
  } catch {
    // replis cookie + mémoire
  }
  return fbp;
}

/**
 * _fbc : identifiant de clic publicitaire. Posé par le Pixel quand l'URL
 * contient ?fbclid=… ; quand le Pixel est bloqué, on le dérive nous-mêmes du
 * paramètre (format documenté fb.1.{ms}.{fbclid}) et on le persiste — c'est
 * lui qui permet d'attribuer une conversion à la campagne d'origine.
 * La spec Meta exige le fbclid LE PLUS RÉCENT : un nouveau clic publicitaire
 * écrase le cookie existant (comme le fait le Pixel officiel) — sinon
 * l'attribution resterait figée 90 jours sur la première campagne cliquée.
 */
function getOrDeriveFbc(): string | null {
  const existing = readCookie(FBC_COOKIE);
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (!fbclid) return existing;
    // fbc = fb.{index}.{ms}.{fbclid} — slice(3) tolère un fbclid contenant des points
    if (existing && existing.split(".").slice(3).join(".") === fbclid) return existing;
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    writeCookie(FBC_COOKIE, fbc, 90 * 24 * 60 * 60);
    return fbc;
  } catch {
    return existing;
  }
}

/** Id first-party stable (aléatoire, jamais de PII) — améliore le match CAPI. */
function getOrCreateExternalId(): string | null {
  try {
    let id = localStorage.getItem(EXTERNAL_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(EXTERNAL_ID_KEY, id);
    }
    return id;
  } catch {
    return null; // pas de storage : on s'appuie sur fbp/IP/UA côté serveur
  }
}

/**
 * Identifiants navigateur pour les attributs de panier Shopify (cart.ts).
 * Null si le tracking Meta est désactivé — aucun id n'est alors généré.
 */
export function getMetaBrowserIds(): { fbp: string | null; fbc: string | null } {
  if (!PIXEL_ID) return { fbp: null, fbc: null };
  return { fbp: getOrCreateFbp(), fbc: getOrDeriveFbc() };
}

// ---------- Pixel (chemin navigateur) ----------

/** Stub fbq officiel : file d'attente tant que fbevents.js n'a pas chargé. */
function injectPixelStub() {
  if (window.fbq) return;
  const fbq: Fbq & { callMethod?: Fbq; queue?: unknown[]; push?: Fbq; loaded?: boolean; version?: string } =
    function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue!.push(args);
      }
    };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

// ---------- Relais serveur (chemin first-party, insensible aux bloqueurs) ----------

function sendToRelay(eventName: string, eventId: string, customData: Record<string, unknown>) {
  const body = JSON.stringify({
    eventName,
    eventId,
    eventTime: new Date().toISOString(),
    sourceUrl: window.location.href,
    email: getIdentifiedEmail(),
    externalId: getOrCreateExternalId(),
    fbp: getOrCreateFbp(),
    fbc: getOrDeriveFbc(),
    customData,
  });
  try {
    // sendBeacon survit à la navigation (checkout, fermeture d'onglet)
    if (!navigator.sendBeacon?.("/api/meta-events", new Blob([body], { type: "application/json" }))) {
      fetch("/api/meta-events", {
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

/** Identifiant stable partagé entre le fire Pixel et le fire CAPI (dédoublonnage Meta). */
function makeEventId(event: string): string {
  return `${event}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/** Envoie un événement par les deux chemins (best effort, jamais bloquant). */
export function trackMeta(eventName: string, customData: Record<string, unknown> = {}) {
  if (!PIXEL_ID) return;
  const eventId = makeEventId(eventName);
  try {
    window.fbq?.("track", eventName, customData, { eventID: eventId });
  } catch {
    // le tracking ne doit jamais faire échouer la page
  }
  sendToRelay(eventName, eventId, customData);
}

/**
 * À appeler au chargement de chaque page (voir Layout.astro) : injecte le
 * Pixel, l'initialise avec l'external_id first-party, et émet le PageView
 * (double flux, comme tout le reste).
 */
export function initMetaPixel() {
  if (!PIXEL_ID) return;
  try {
    injectPixelStub();
    const externalId = getOrCreateExternalId();
    window.fbq?.("init", PIXEL_ID, externalId ? { external_id: externalId } : undefined);
    trackMeta("PageView");
  } catch {
    // best effort
  }
}

// ---------- Helpers e-commerce (formes standard Meta) ----------

/** "gid://shopify/ProductVariant/4323…" → "4323…" (ids numériques attendus par les catalogues Meta). */
export function shopifyNumericId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export type MetaContent = { id: string; quantity: number; item_price: number };

/** ViewContent — page produit ou coffret. */
export function metaViewContent(data: {
  contentId: string;
  contentName: string;
  value: number;
  currency: string;
}) {
  trackMeta("ViewContent", {
    content_ids: [data.contentId],
    content_name: data.contentName,
    content_type: "product",
    value: data.value,
    currency: data.currency,
  });
}

/** AddToCart — lignes réellement ajoutées (pas le panier entier). */
export function metaAddToCart(data: { contents: MetaContent[]; value: number; currency: string }) {
  if (!data.contents.length) return;
  // Les ajouts à 0 (échantillon offert, notamment auto-ajouté par le drawer)
  // ne signalent aucune intention d'achat : les envoyer dégraderait
  // l'optimisation des campagnes. Klaviyo les garde (utile aux flows), Meta non.
  if (data.value <= 0) return;
  trackMeta("AddToCart", {
    content_ids: data.contents.map((c) => c.id),
    contents: data.contents,
    content_type: "product",
    value: data.value,
    currency: data.currency,
  });
}

/** InitiateCheckout — au clic sur le bouton checkout du panier. */
export function metaInitiateCheckout(data: {
  contents: MetaContent[];
  value: number;
  currency: string;
}) {
  trackMeta("InitiateCheckout", {
    content_ids: data.contents.map((c) => c.id),
    contents: data.contents,
    content_type: "product",
    num_items: data.contents.reduce((sum, c) => sum + c.quantity, 0),
    value: data.value,
    currency: data.currency,
  });
}
