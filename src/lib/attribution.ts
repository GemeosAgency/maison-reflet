/**
 * Attribution publicitaire portée jusqu'au checkout Shopify (kit checkout
 * headless, modèle Pufflo) : gardée 30 jours, pas seulement la visite.
 *
 * À l'arrivée, les paramètres de pub (utm_*, gclid, fbclid…) sont lus et
 * gardés sur l'appareil ; au paiement ils sont ajoutés à l'adresse du checkout
 * et aux attributs de la commande (cart.ts), pour que Shopify, Meta et Google
 * sachent quelle pub a vendu le flacon. Le dernier clic pub gagne : une
 * nouvelle arrivée avec d'autres paramètres remplace l'enregistrement ; une
 * page interne, un rechargement ou le bouton Retour, non. Passé
 * ATTRIBUTION_DAYS sans nouveau clic, l'enregistrement est oublié.
 *
 * Même module : le marqueur « appareil de l'équipe » (`?internal=1` pose,
 * `?internal=0` retire). Ces appareils ne déclenchent ni Pixel ni GA4, et leurs
 * commandes ne sont pas remontées à Meta ni à Google (webhook, pixel du
 * checkout).
 *
 * Importé par le Layout : il tourne sur toutes les pages.
 */
const ATTRIBUTION_DAYS = 30;

const KEY = "maison-reflet:attribution";
const INTERNAL_KEY = "maison-reflet:internal";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];
const CLICK = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"];
const AD_KEYS = [...UTM, ...CLICK];
type Attribution = { p: Record<string, string>; lp: string; ref: string; t: number };

// Texte libre (utm_*) : sans caractères de contrôle, invisibles ou bidi, sans <>"`\, 200 caractères au plus.
function cleanText(raw: unknown, max = 200): string {
  if (typeof raw !== "string") return "";
  const s = raw.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>"`\\]/gu, "").replace(/\s+/g, " ").trim();
  if (/^(javascript|data|vbscript|file)\s*:/i.test(s)) return "";
  return Array.from(s).slice(0, max).join("").trim();
}
// Un identifiant de clic garde sa valeur exacte ou disparaît (un id tronqué ne vaut rien).
const cleanClick = (raw: unknown) => (typeof raw === "string" && /^[A-Za-z0-9._~-]{1,500}$/.test(raw) ? raw : "");
const clean = (key: string, raw: unknown) => (CLICK.includes(key) ? cleanClick(raw) : cleanText(raw));

function adParams(q: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of AD_KEYS) {
    const v = clean(k, q.get(k));
    if (v) out[k] = v;
  }
  return out;
}
// Page d'arrivée : le chemin et les paramètres non publicitaires, sans rien qui ressemble à un e-mail ou un secret.
function landingPage(q: URLSearchParams): string {
  const rest = new URLSearchParams();
  q.forEach((v, k) => {
    if (!AD_KEYS.includes(k) && k !== "internal" && !v.includes("@") && !/mail|token|pass|secret|auth|sig|key/i.test(k)) {
      rest.append(k, v);
    }
  });
  const qs = rest.toString();
  return (location.pathname + (qs ? `?${qs}` : "")).slice(0, 300);
}
// Référent externe seulement (origine + chemin) : nos domaines, checkout compris, ne comptent pas.
function externalReferrer(): string {
  try {
    if (!document.referrer) return "";
    const r = new URL(document.referrer);
    if (!/^https?:$/.test(r.protocol) || r.hostname === location.hostname || /(^|\.)maisonreflet\.com$/.test(r.hostname)) return "";
    return cleanText(r.origin + r.pathname, 200);
  } catch {
    return "";
  }
}
function read(): Attribution | null {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!j || typeof j !== "object" || typeof j.t !== "number") return null;
    if (Date.now() - j.t > ATTRIBUTION_DAYS * 86_400_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    // Relu comme une entrée extérieure : tout est nettoyé à nouveau.
    const p: Record<string, string> = {};
    for (const k of AD_KEYS) {
      const v = clean(k, j.p?.[k]);
      if (v) p[k] = v;
    }
    const lp = typeof j.lp === "string" && j.lp.startsWith("/") ? cleanText(j.lp, 300) : "";
    return { p, lp, ref: cleanText(j.ref, 200), t: j.t };
  } catch {
    return null;
  }
}
function capture(): void {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("internal") === "1") localStorage.setItem(INTERNAL_KEY, "1");
    if (q.get("internal") === "0") localStorage.removeItem(INTERNAL_KEY);

    const p = adParams(q);
    const stored = read();
    const nav = (performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined)?.type;
    // Un enregistrement en place n'est remplacé que par une vraie nouvelle arrivée publicitaire.
    if (stored && (!Object.keys(p).length || nav === "reload" || nav === "back_forward")) return;
    if (!stored && !Object.keys(p).length && !externalReferrer()) return;
    localStorage.setItem(KEY, JSON.stringify({ p, lp: landingPage(q), ref: externalReferrer(), t: Date.now() }));
  } catch {
    /* stockage bloqué : rien de visible */
  }
}
if (typeof window !== "undefined") capture();

/** Appareil de l'équipe (`?internal=1`) : jamais compté par les pixels ni les achats. */
export function isInternalDevice(): boolean {
  try {
    return localStorage.getItem(INTERNAL_KEY) === "1";
  } catch {
    return false;
  }
}

/** L'adresse du checkout avec les paramètres de pub : ceux de Shopify gagnent, une adresse cassée n'est jamais produite. */
export function withAttribution(url: string): string {
  try {
    const a = read();
    if (!a || !Object.keys(a.p).length) return url;
    const u = new URL(url);
    if (u.protocol !== "https:") return url;
    for (const [k, v] of Object.entries(a.p)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

/** Attributs de panier, visibles sur la commande dans Shopify (« Détails supplémentaires »). */
export function attributionAttributes(): { key: string; value: string }[] {
  try {
    const a = read();
    if (!a) return [];
    const out = Object.entries(a.p).map(([key, value]) => ({ key, value }));
    if (a.lp) out.push({ key: "landing_page", value: a.lp });
    if (a.ref) out.push({ key: "referrer", value: a.ref });
    return out;
  } catch {
    return [];
  }
}
