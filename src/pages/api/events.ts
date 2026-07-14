import type { APIRoute } from "astro";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

/**
 * Relais first-party des événements Klaviyo (tracking « server-side »).
 *
 * Pourquoi : les bloqueurs de contenu bloquent *.klaviyo.com (klaviyo.js et son
 * endpoint client), mais pas les requêtes vers notre propre domaine. Le
 * navigateur poste donc ici, et ce endpoint transmet à l'API serveur Klaviyo
 * avec la clé privée — jamais exposée au client. L'aiguillage côté navigateur
 * (qui passe par ici, quand, avec quelle identité) est dans src/lib/klaviyo.ts.
 *
 * Garde-fous :
 * - liste blanche d'événements : ce relais ne sert qu'aux événements du site ;
 * - email requis : on ne crée JAMAIS de profil anonyme (Klaviyo facture au
 *   nombre de profils actifs) ;
 * - taille bornée + Origin contrôlée : endpoint public, on limite l'abus ;
 * - `unique_id` : dédoublonnage Klaviyo (rejeu/ré-émission sans doublon) ;
 * - `time` : permet de rejouer un événement passé avec son vrai horodatage
 *   (file locale des visiteurs anonymes, rejouée à l'identification).
 */

const KLAVIYO_API_KEY = import.meta.env.KLAVIYO_PRIVATE_API_KEY;
const KLAVIYO_REVISION = "2025-04-15";

const ALLOWED_EVENTS = new Set(["Viewed Product", "Added to Cart"]);
const ALLOWED_ORIGINS = new Set([
  "https://staging.maisonreflet.com",
  "https://maisonreflet.com",
  "https://www.maisonreflet.com",
  "http://localhost:4321",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PROPERTIES_JSON = 16_000; // large pour un panier complet, bloque l'abus
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // rejeu d'historique : 7 jours max
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000; // tolérance d'horloge client

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (!KLAVIYO_API_KEY) {
    return json({ ok: false, error: "Tracking serveur non configuré." }, 503);
  }

  // Un POST cross-site enverra une Origin étrangère ; on ne sert que le site.
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, error: "Origine refusée." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400);
  }

  const event = String(body?.event ?? "");
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const properties = body?.properties;
  const uniqueId =
    typeof body?.uniqueId === "string" && body.uniqueId.length <= 128 ? body.uniqueId : undefined;

  if (!ALLOWED_EVENTS.has(event)) {
    return json({ ok: false, error: "Événement non autorisé." }, 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: "Email invalide." }, 400);
  }
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return json({ ok: false, error: "Propriétés invalides." }, 400);
  }
  if (JSON.stringify(properties).length > MAX_PROPERTIES_JSON) {
    return json({ ok: false, error: "Propriétés trop volumineuses." }, 400);
  }

  // Horodatage optionnel (rejeu de la file locale) : borné passé/futur.
  let time: string | undefined;
  if (typeof body?.time === "string") {
    const parsed = Date.parse(body.time);
    const age = Date.now() - parsed;
    if (Number.isNaN(parsed) || age > MAX_EVENT_AGE_MS || age < -MAX_FUTURE_DRIFT_MS) {
      return json({ ok: false, error: "Horodatage invalide." }, 400);
    }
    time = new Date(parsed).toISOString();
  }

  // $value (convention klaviyo.js) devient l'attribut `value` de l'API serveur.
  const rawValue = (properties as Record<string, unknown>).$value;
  const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : undefined;

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties,
        ...(value !== undefined && { value }),
        ...(uniqueId && { unique_id: uniqueId }),
        ...(time && { time }),
        metric: { data: { type: "metric", attributes: { name: event } } },
        profile: { data: { type: "profile", attributes: { email } } },
      },
    },
  };

  try {
    const res = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[api/events] Klaviyo a refusé l'événement :", res.status, detail.slice(0, 500));
      return json({ ok: false, error: "Relais Klaviyo en échec." }, 502);
    }
  } catch (error) {
    console.error("[api/events]", error);
    return json({ ok: false, error: "Relais Klaviyo injoignable." }, 502);
  }

  return json({ ok: true }, 202);
};
