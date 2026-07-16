import type { APIRoute } from "astro";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

/**
 * Relais first-party des événements GA4 (Measurement Protocol).
 *
 * Pendant du relais Meta (src/pages/api/meta-events.ts) : les bloqueurs de
 * contenu bloquent googletagmanager.com/google-analytics.com aussi souvent
 * que facebook.com. Quand gtag.js échoue à charger (voir lib/ga4.ts), le
 * navigateur poste ici à la place, et ce endpoint transmet au Measurement
 * Protocol. Contrairement au relais Meta, celui-ci ne tourne QUE quand
 * gtag.js est bloqué — jamais en parallèle d'un gtag.js qui fonctionne, GA4
 * ne dédoublonnant pas deux hits d'un même événement générique.
 *
 * L'événement purchase ne passe PAS par ici : il est capté par le webhook
 * Shopify orders/paid (voir src/pages/api/webhooks/shopify-orders.ts), seule
 * source fiable en headless (checkout hors domaine).
 *
 * Inerte (503) tant que GA4_API_SECRET n'est pas configurée.
 */

const MEASUREMENT_ID = import.meta.env.PUBLIC_GA4_MEASUREMENT_ID;
const API_SECRET = import.meta.env.GA4_API_SECRET;
// En mode debug, poste vers l'endpoint de validation GA4 (ne compte pas dans
// les rapports, renvoie le détail des erreurs de schéma) plutôt que le vrai
// endpoint de collecte. RETIRER en production.
const DEBUG_MODE = import.meta.env.GA4_DEBUG_MODE === "true";

const COLLECT_URL = DEBUG_MODE
  ? "https://www.google-analytics.com/debug/mp/collect"
  : "https://www.google-analytics.com/mp/collect";

const ALLOWED_EVENTS = new Set(["page_view", "view_item", "add_to_cart", "begin_checkout"]);
const ALLOWED_ORIGINS = new Set([
  "https://staging.maisonreflet.com",
  "https://maisonreflet.com",
  "https://www.maisonreflet.com",
  "http://localhost:4321",
]);
// Le endpoint est public, on ne relaie pas de paramètres arbitraires vers GA4.
const ALLOWED_PARAM_KEYS = new Set(["currency", "value", "items", "page_location", "page_title"]);

const MAX_PARAMS_JSON = 8_000;
const MAX_ITEMS = 20;
// Format posé par gtag.js / dérivé nous-mêmes (voir lib/ga4.ts) : {aléa}.{timestamp}.
const CLIENT_ID_RE = /^\d+\.\d+$/;

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitizeItems(items: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return null;
  const sanitized = items.map((item) => {
    if (typeof item !== "object" || item === null) return null;
    const { item_id, item_name, price, quantity } = item as Record<string, unknown>;
    if (typeof item_id !== "string" || typeof item_name !== "string") return null;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;
    return {
      item_id,
      item_name,
      price,
      ...(typeof quantity === "number" && Number.isFinite(quantity) && { quantity }),
    };
  });
  return sanitized.every((i) => i !== null) ? (sanitized as Record<string, unknown>[]) : null;
}

export const POST: APIRoute = async ({ request }) => {
  if (!MEASUREMENT_ID || !API_SECRET) {
    return json({ ok: false, error: "Tracking GA4 non configuré." }, 503);
  }

  // Un POST cross-site enverra une Origin étrangère ; on ne sert que le site.
  // Origin obligatoire (comme le relais Meta) : chaque événement relayé est
  // signé auprès de Google avec notre secret serveur.
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, error: "Origine refusée." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400);
  }

  const eventName = String(body?.eventName ?? "");
  if (!ALLOWED_EVENTS.has(eventName)) {
    return json({ ok: false, error: "Événement non autorisé." }, 400);
  }

  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  if (!CLIENT_ID_RE.test(clientId)) {
    return json({ ok: false, error: "client_id invalide." }, 400);
  }

  const sourceUrl =
    typeof body?.sourceUrl === "string" &&
    body.sourceUrl.length <= 2048 &&
    /^https?:\/\//.test(body.sourceUrl)
      ? body.sourceUrl
      : undefined;

  const rawParams = body?.params;
  if (typeof rawParams !== "object" || rawParams === null || Array.isArray(rawParams)) {
    return json({ ok: false, error: "params invalide." }, 400);
  }
  if (JSON.stringify(rawParams).length > MAX_PARAMS_JSON) {
    return json({ ok: false, error: "params trop volumineux." }, 400);
  }

  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawParams as Record<string, unknown>)) {
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (key === "items") {
      const sanitized = sanitizeItems(value);
      if (sanitized) params.items = sanitized;
      continue;
    }
    params[key] = value;
  }
  if (sourceUrl) params.page_location = params.page_location ?? sourceUrl;

  const payload = {
    client_id: clientId,
    events: [{ name: eventName, params }],
  };

  try {
    const res = await fetch(`${COLLECT_URL}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // /mp/collect répond 204 sans corps même en cas de payload rejeté (silencieux
    // par design) ; /debug/mp/collect (mode validation) répond 200 avec le détail.
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[api/ga4-events] GA4 a refusé la requête :", res.status, detail.slice(0, 500));
      return json({ ok: false, error: "Relais GA4 en échec." }, 502);
    }
    if (DEBUG_MODE) {
      const detail = await res.text().catch(() => "");
      console.warn("[api/ga4-events] Validation GA4 :", detail.slice(0, 1000));
    }
  } catch (error) {
    console.error("[api/ga4-events]", error);
    return json({ ok: false, error: "Relais GA4 injoignable." }, 502);
  }

  return json({ ok: true }, 202);
};
