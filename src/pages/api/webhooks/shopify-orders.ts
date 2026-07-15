import type { APIRoute } from "astro";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

/**
 * Webhook Shopify orders/paid → événement Purchase (Meta Conversions API).
 *
 * Pourquoi un webhook : en headless, le checkout se passe hors de notre
 * domaine (checkout.shopify.com, voire shop.app avec Shop Pay) — aucun Pixel
 * chargé par CE site ne peut y voir la conversion. Le webhook serveur est la
 * seule source fiable du Purchase, avec en bonus les données exactes de la
 * commande (montant réel payé, lignes, email vérifié).
 *
 * Attribution : les cookies _fbp/_fbc du navigateur sont posés en attributs
 * de panier à la création (voir cart.ts) et reviennent ici dans
 * note_attributes — c'est ce qui rattache l'achat au clic publicitaire
 * d'origine malgré le saut de domaine.
 *
 * Idempotence : event_id = "purchase:{order_id}". Shopify rejoue les webhooks
 * non acquittés (jusqu'à 19 fois sur 48 h) ; Meta dédoublonne sur event_id,
 * donc les rejeux sont sans effet — on peut répondre 5xx sans risque pour
 * forcer un rejeu quand Meta est temporairement injoignable.
 *
 * À CONFIGURER (Shopify Admin → Settings → Notifications → Webhooks) :
 *  - créer un webhook "Order payment" (orders/paid) vers
 *    https://maisonreflet.com/api/webhooks/shopify-orders
 *  - copier la clé de signature affichée en bas de la page des webhooks dans
 *    SHOPIFY_WEBHOOK_SECRET (voir .env.example).
 */

const PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = import.meta.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = import.meta.env.META_TEST_EVENT_CODE;
const WEBHOOK_SECRET = import.meta.env.SHOPIFY_WEBHOOK_SECRET;
const GRAPH_API_VERSION = "v23.0";

const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // limite dure côté CAPI

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Vérification HMAC-SHA256 de l'authenticité Shopify (comparaison à temps constant). */
function isValidShopifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let received: Buffer;
  try {
    received = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }
  return digest.length === received.length && timingSafeEqual(digest, received);
}

/**
 * Téléphone → chiffres seuls avec indicatif pays (E.164 sans "+", exigé par
 * Meta avant hachage). Seuls les numéros déjà internationaux ("+…") passent :
 * customer.phone l'est toujours (garanti Shopify), mais billing_address.phone
 * est saisi librement au checkout — un numéro local ("050 123 4567") haché
 * sans indicatif ne matcherait jamais rien, mieux vaut omettre le champ.
 */
function normalizePhone(phone: unknown): string | null {
  if (typeof phone !== "string" || !phone.trim().startsWith("+")) return null;
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 8 ? digits : null;
}

// Format des cookies Meta (même garde-fou que le relais /api/meta-events) :
// les attributs de panier sont modifiables par n'importe quel client via la
// Storefront API publique, on ne relaie pas de valeurs arbitraires vers Meta.
const FB_COOKIE_RE = /^fb\.\d\.\d+\..+$/;

// Sous-ensemble du payload orders/paid réellement utilisé (l'objet complet
// est bien plus large) — champs tous optionnels par prudence.
type ShopifyOrderWebhook = {
  id?: number;
  test?: boolean;
  email?: string | null;
  contact_email?: string | null;
  total_price?: string;
  currency?: string;
  processed_at?: string | null;
  created_at?: string | null;
  order_status_url?: string | null;
  line_items?: {
    variant_id?: number | null;
    quantity?: number;
    price?: string;
  }[];
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  billing_address?: { phone?: string | null } | null;
  client_details?: { browser_ip?: string | null; user_agent?: string | null } | null;
  note_attributes?: { name?: string; value?: string }[];
};

export const POST: APIRoute = async ({ request }) => {
  // Sans clé de signature, impossible de distinguer Shopify d'un POST forgé :
  // on refuse de traiter plutôt que de relayer des données non authentifiées.
  if (!WEBHOOK_SECRET) {
    console.error("[webhooks/shopify-orders] SHOPIFY_WEBHOOK_SECRET absente — webhook ignoré.");
    return json({ ok: false, error: "Webhook non configuré." }, 503);
  }

  // Le corps BRUT est nécessaire pour l'HMAC — le parser avant vérification
  // invaliderait la signature (ré-encodage JSON non identique à l'octet près).
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!hmacHeader || !isValidShopifyHmac(rawBody, hmacHeader, WEBHOOK_SECRET)) {
    return json({ ok: false, error: "Signature invalide." }, 401);
  }

  // Authentifié à partir d'ici. Répondre 200 sur tout ce qu'on choisit de ne
  // pas traiter : un non-200 fait rejouer Shopify pour rien, et des échecs
  // répétés finissent par faire SUPPRIMER le webhook par Shopify.
  const topic = request.headers.get("x-shopify-topic");
  if (topic !== "orders/paid") {
    return json({ ok: true, skipped: `topic ${topic ?? "inconnu"}` }, 200);
  }

  // Tracking Meta pas encore configuré : acquitter sans traiter (mode
  // placeholder — le webhook peut être branché avant les clés Meta).
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[webhooks/shopify-orders] Clés Meta absentes — Purchase non relayé.");
    return json({ ok: true, skipped: "tracking Meta non configuré" }, 200);
  }

  let order: ShopifyOrderWebhook;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return json({ ok: true, skipped: "corps illisible" }, 200);
  }

  if (!order.id) return json({ ok: true, skipped: "commande sans id" }, 200);

  // Commandes de test Shopify (passerelle Bogus / boutique test) : ne pas
  // polluer les données publicitaires réelles. Pour tester le flux de bout en
  // bout, utiliser META_TEST_EVENT_CODE avec une vraie commande à 100 % de
  // remise plutôt qu'une commande test.
  if (order.test) {
    return json({ ok: true, skipped: "commande de test" }, 200);
  }

  // ---------- user_data ----------
  const userData: Record<string, unknown> = {};

  const email = (order.email ?? order.contact_email ?? "").trim().toLowerCase();
  if (email) userData.em = [sha256(email)];

  const phone = normalizePhone(order.customer?.phone ?? order.billing_address?.phone);
  if (phone) userData.ph = [sha256(phone)];

  const firstName = order.customer?.first_name?.trim().toLowerCase();
  if (firstName) userData.fn = [sha256(firstName)];
  const lastName = order.customer?.last_name?.trim().toLowerCase();
  if (lastName) userData.ln = [sha256(lastName)];

  // IP + user-agent du NAVIGATEUR DE L'ACHETEUR au checkout (fournis par
  // Shopify dans la commande) — pas ceux de la requête webhook (Shopify).
  if (order.client_details?.browser_ip) {
    userData.client_ip_address = order.client_details.browser_ip;
  }
  if (order.client_details?.user_agent) {
    userData.client_user_agent = order.client_details.user_agent;
  }

  // _fbp/_fbc posés en attributs de panier par cart.ts, revenus avec la
  // commande — format validé avant relais (attributs falsifiables côté client).
  for (const attr of order.note_attributes ?? []) {
    const value = attr.value ?? "";
    if (!FB_COOKIE_RE.test(value)) continue;
    if (attr.name === "_fbp" && value.length <= 128) userData.fbp = value;
    if (attr.name === "_fbc" && value.length <= 512) userData.fbc = value;
  }

  // ---------- custom_data ----------
  const contents = (order.line_items ?? [])
    .filter((li) => li.variant_id != null && (li.quantity ?? 0) > 0)
    .map((li) => ({
      id: String(li.variant_id),
      quantity: li.quantity ?? 1,
      item_price: Number(li.price ?? 0),
    }));

  const value = Number(order.total_price ?? 0);

  // Horodatage réel du paiement, borné à la fenêtre CAPI (7 jours) — un rejeu
  // très tardif du webhook garde ainsi un event_time acceptable.
  const paidAtMs = Date.parse(order.processed_at ?? order.created_at ?? "") || Date.now();
  const eventTimeMs = Math.min(Math.max(paidAtMs, Date.now() - MAX_EVENT_AGE_MS), Date.now());

  // action_source "website" exige client_user_agent et event_source_url côté
  // CAPI (l'événement serait rejeté sans eux). Une commande sans contexte
  // navigateur (draft order, commande API…) part donc en "other".
  // event_source_url : PAS order_status_url — c'est une URL à jeton porteur
  // (accès sans authentification au détail de la commande), on n'exfiltre pas
  // ça vers un tiers. L'origine du site suffit à Meta.
  const isWebsiteOrder = Boolean(order.client_details?.user_agent);
  const siteOrigin = import.meta.env.PUBLIC_SITE_URL || "https://maisonreflet.com";

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(eventTimeMs / 1000),
        event_id: `purchase:${order.id}`,
        action_source: isWebsiteOrder ? "website" : "other",
        ...(isWebsiteOrder && { event_source_url: siteOrigin }),
        user_data: userData,
        custom_data: {
          value,
          currency: order.currency ?? "AED",
          content_type: "product",
          content_ids: contents.map((c) => c.id),
          contents,
          num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
          order_id: String(order.id),
        },
      },
    ],
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
      console.error(
        "[webhooks/shopify-orders] Meta a refusé le Purchase :",
        res.status,
        detail.slice(0, 500)
      );
      // 4xx Meta = configuration (token invalide, payload refusé) : rejouer ne
      // changera rien, on acquitte pour protéger le webhook. 5xx = incident
      // passager : 502 pour que Shopify rejoue (dédoublonné par event_id).
      return res.status >= 500
        ? json({ ok: false, error: "Meta indisponible, rejeu demandé." }, 502)
        : json({ ok: true, skipped: "refus Meta (voir logs)" }, 200);
    }
  } catch (error) {
    console.error("[webhooks/shopify-orders]", error);
    return json({ ok: false, error: "Meta injoignable, rejeu demandé." }, 502);
  }

  return json({ ok: true }, 200);
};
