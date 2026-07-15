import type { APIRoute } from "astro";
import { createHash } from "node:crypto";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

/**
 * Relais first-party des événements Meta (Conversions API).
 *
 * Pendant du relais Klaviyo (src/pages/api/events.ts) : les bloqueurs de
 * contenu bloquent connect.facebook.net et facebook.com, mais pas notre
 * domaine. Le navigateur poste ici (src/lib/meta.ts), et ce endpoint transmet
 * à la Conversions API avec le token secret — jamais exposé au client. Le
 * même event_id part aussi par le Pixel navigateur : Meta dédoublonne
 * nativement les paires (event_name, event_id), jamais de doublon.
 *
 * Différence assumée avec le relais Klaviyo : PAS d'email requis. Klaviyo
 * facture au profil (créer des profils anonymes coûte), Meta non — un
 * événement anonyme (fbp + IP + user-agent) a de la valeur pour
 * l'optimisation des campagnes. L'email, quand il est connu, est haché en
 * SHA-256 ici, côté serveur, avant transmission (jamais en clair vers Meta).
 *
 * L'événement Purchase ne passe PAS par ici : il est capté par le webhook
 * Shopify orders/paid (voir src/pages/api/webhooks/shopify-orders.ts), seule
 * source fiable en headless (checkout hors domaine).
 *
 * Inerte (503) tant que META_CAPI_ACCESS_TOKEN n'est pas configurée.
 */

const PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = import.meta.env.META_CAPI_ACCESS_TOKEN;
// Optionnel : code "Test events" d'Events Manager, pour valider le flux
// avant le go-live sans polluer les données réelles.
const TEST_EVENT_CODE = import.meta.env.META_TEST_EVENT_CODE;
const GRAPH_API_VERSION = "v23.0";

const ALLOWED_EVENTS = new Set(["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]);
const ALLOWED_ORIGINS = new Set([
  "https://staging.maisonreflet.com",
  "https://maisonreflet.com",
  "https://www.maisonreflet.com",
  "http://localhost:4321",
]);
// Seules les clés custom_data standard utilisées par le site passent — le
// endpoint est public, on ne relaie pas de données arbitraires vers Meta.
const ALLOWED_CUSTOM_DATA_KEYS = new Set([
  "content_ids",
  "content_name",
  "content_type",
  "contents",
  "num_items",
  "value",
  "currency",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Format des cookies Meta : fb.{subdomainIndex}.{timestamp}.{valeur}
const FB_COOKIE_RE = /^fb\.\d\.\d+\..+$/;
const MAX_CUSTOM_DATA_JSON = 16_000;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // limite dure côté CAPI

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Hachage SHA-256 hex — format attendu par Meta pour les données PII. */
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const POST: APIRoute = async (context) => {
  const { request } = context;
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return json({ ok: false, error: "Tracking Meta non configuré." }, 503);
  }

  // Origin OBLIGATOIRE ici (plus strict que le relais Klaviyo) : chaque
  // événement relayé est signé auprès de Meta avec notre token serveur —
  // plus crédible qu'un hit Pixel, donc plus intéressant à empoisonner. Les
  // navigateurs envoient toujours Origin sur un POST (fetch et sendBeacon
  // inclus) : exiger sa présence ne coûte aucun événement légitime et écarte
  // les clients non-navigateur naïfs. (Un forgeur outillé peut l'imiter —
  // limite assumée de tout relais CAPI public.)
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

  const eventId =
    typeof body?.eventId === "string" && body.eventId.length <= 128 ? body.eventId : undefined;
  if (!eventId) {
    return json({ ok: false, error: "eventId requis (dédoublonnage Pixel/CAPI)." }, 400);
  }

  // Horodatage : rejet au-delà de 7 jours passés (limite dure CAPI, et rien
  // de légitime n'envoie ici en différé) ; un horodatage FUTUR est ramené à
  // maintenant plutôt que rejeté — l'événement vient d'arriver, c'est
  // l'horloge du client qui est fausse, pas l'événement.
  const parsedTime = typeof body?.eventTime === "string" ? Date.parse(body.eventTime) : NaN;
  if (Number.isNaN(parsedTime) || Date.now() - parsedTime > MAX_EVENT_AGE_MS) {
    return json({ ok: false, error: "Horodatage invalide." }, 400);
  }
  const eventTimeMs = Math.min(parsedTime, Date.now());

  const sourceUrl =
    typeof body?.sourceUrl === "string" &&
    body.sourceUrl.length <= 2048 &&
    /^https?:\/\//.test(body.sourceUrl)
      ? body.sourceUrl
      : undefined;

  const rawCustomData = body?.customData;
  if (typeof rawCustomData !== "object" || rawCustomData === null || Array.isArray(rawCustomData)) {
    return json({ ok: false, error: "customData invalide." }, 400);
  }
  const customData = Object.fromEntries(
    Object.entries(rawCustomData as Record<string, unknown>).filter(([k]) =>
      ALLOWED_CUSTOM_DATA_KEYS.has(k)
    )
  );
  if (JSON.stringify(customData).length > MAX_CUSTOM_DATA_JSON) {
    return json({ ok: false, error: "customData trop volumineux." }, 400);
  }

  // ---------- user_data : identifiants de matching ----------
  // IP + user-agent viennent de la requête elle-même (fiables), le reste du
  // navigateur (validé en format). PII (email) hachée ici, jamais en clair.
  const userData: Record<string, unknown> = {};

  const userAgent = request.headers.get("user-agent");
  if (userAgent) userData.client_user_agent = userAgent;

  // Derrière Vercel, clientAddress reflète le premier x-forwarded-for
  // (client réel). Accédé via `context` DANS le try : c'est un getter qui
  // jette hors adaptateur — le destructurer dans la signature du handler
  // l'exécuterait avant toute protection.
  try {
    if (context.clientAddress) userData.client_ip_address = context.clientAddress;
  } catch {
    // pas d'IP disponible — le matching s'appuie sur fbp/em/external_id
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email && EMAIL_RE.test(email) && email.length <= 254) {
    userData.em = [sha256(email)];
  }

  const externalId = typeof body?.externalId === "string" ? body.externalId : "";
  if (externalId && externalId.length <= 128) {
    userData.external_id = [sha256(externalId)];
  }

  const fbp = typeof body?.fbp === "string" ? body.fbp : "";
  if (fbp && fbp.length <= 128 && FB_COOKIE_RE.test(fbp)) userData.fbp = fbp;

  const fbc = typeof body?.fbc === "string" ? body.fbc : "";
  if (fbc && fbc.length <= 512 && FB_COOKIE_RE.test(fbc)) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(eventTimeMs / 1000),
        event_id: eventId,
        action_source: "website",
        ...(sourceUrl && { event_source_url: sourceUrl }),
        user_data: userData,
        custom_data: customData,
      },
    ],
    // Token dans le corps (pas l'URL) : n'apparaît jamais dans les logs d'accès.
    access_token: ACCESS_TOKEN,
    ...(TEST_EVENT_CODE && { test_event_code: TEST_EVENT_CODE }),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[api/meta-events] Meta a refusé l'événement :", res.status, detail.slice(0, 500));
      return json({ ok: false, error: "Relais Meta en échec." }, 502);
    }
  } catch (error) {
    console.error("[api/meta-events]", error);
    return json({ ok: false, error: "Relais Meta injoignable." }, 502);
  }

  return json({ ok: true }, 202);
};
