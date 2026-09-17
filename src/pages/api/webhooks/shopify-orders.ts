import type { APIRoute } from "astro";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { adminDb } from "../../../lib/admin/db";
import { isTestHost } from "../../../lib/admin/env";
import { getAllProducts } from "../../../lib/shopify";
import { AVOIR_AED, COFFRET_HANDLE, MINIMUM_AED, REFLETS, VALIDITE_JOURS, codeAvoir, finValidite } from "../../../lib/coffret";
import { creerAvoir, idsProduits } from "../../../lib/shopify-admin";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

/**
 * Webhook Shopify orders/paid → événement Purchase (Meta Conversions API +
 * GA4 Measurement Protocol).
 *
 * Pourquoi un webhook : en headless, le checkout se passe hors de notre
 * domaine (checkout.shopify.com, voire shop.app avec Shop Pay) — aucun Pixel
 * ni gtag.js chargé par CE site ne peut y voir la conversion. Le webhook
 * serveur est la seule source fiable du Purchase, avec en bonus les données
 * exactes de la commande (montant réel payé, lignes, email vérifié).
 *
 * Attribution : les cookies _fbp/_fbc (Meta) et le client_id _ga (GA4) sont
 * posés en attributs de panier à la création (voir cart.ts) et reviennent
 * ici dans note_attributes — c'est ce qui rattache l'achat au clic
 * publicitaire d'origine / à la bonne session GA4 malgré le saut de domaine.
 *
 * Idempotence : Meta dédoublonne sur event_id ("purchase:{order_id}"). GA4
 * dédoublonne les "purchase" par transaction_id — les deux tolèrent donc les
 * rejeux Shopify (jusqu'à 19 fois sur 48 h) sans compter la vente en double ;
 * on peut répondre 5xx sans risque pour forcer un rejeu en cas d'incident
 * passager côté Meta ou GA4.
 *
 * À CONFIGURER (Shopify Admin → Settings → Notifications → Webhooks) :
 *  - créer TROIS webhooks vers https://maisonreflet.com/api/webhooks/shopify-orders
 *    (format JSON) : « Paiement de commande » (orders/paid), « Création de
 *    remboursement » (refunds/create), « Annulation de commande » (orders/cancelled) ;
 *  - copier la clé de signature affichée en bas de la page des webhooks dans
 *    SHOPIFY_WEBHOOK_SECRET (voir .env.example).
 * Les remboursements et annulations n'alimentent que la tour de contrôle
 * (chiffre net) ; Meta et GA4 ne reçoivent que le Purchase.
 */

const PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = import.meta.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = import.meta.env.META_TEST_EVENT_CODE;
const WEBHOOK_SECRET = import.meta.env.SHOPIFY_WEBHOOK_SECRET;
const GRAPH_API_VERSION = "v23.0";

const GA4_MEASUREMENT_ID = import.meta.env.PUBLIC_GA4_MEASUREMENT_ID;
const GA4_API_SECRET = import.meta.env.GA4_API_SECRET;
const GA4_DEBUG_MODE = import.meta.env.GA4_DEBUG_MODE === "true";
const GA4_COLLECT_URL = GA4_DEBUG_MODE
  ? "https://www.google-analytics.com/debug/mp/collect"
  : "https://www.google-analytics.com/mp/collect";
// Format posé par gtag.js / dérivé nous-mêmes (voir lib/ga4.ts) : {aléa}.{timestamp}.
const GA4_CLIENT_ID_RE = /^\d+\.\d+$/;

const KLAVIYO_API_KEY = import.meta.env.KLAVIYO_PRIVATE_API_KEY;
const KLAVIYO_REVISION = "2025-04-15";
// Sert à dériver le code d'avoir : sans lui, deux clients pourraient deviner le
// code de l'autre à partir du numéro de commande. À défaut, on retombe sur la
// clé du webhook, qui est déjà un secret partagé avec Shopify.
const AVOIR_SEL = import.meta.env.COFFRET_CREDIT_SALT ?? WEBHOOK_SECRET ?? "";

/**
 * L'avoir du coffret découverte : qui achète le coffret reçoit son montant à
 * valoir sur un flacon (voir lib/coffret.ts pour la règle et ses bornes).
 *
 * Le code est créé chez Shopify puis remis au client par Klaviyo. Les deux
 * étapes sont idempotentes : le code est dérivé du numéro de commande (Shopify
 * refuse alors le doublon, ce qu'on lit comme « déjà émis »), et l'événement
 * Klaviyo porte un `unique_id` stable. Shopify rejoue ses webhooks jusqu'à
 * dix-neuf fois sur quarante-huit heures : sans ça, dix-neuf avoirs.
 *
 * Rien ici ne doit faire tomber le webhook : il porte aussi la tour de contrôle,
 * Meta et GA4. Tout échec se journalise et s'arrête là.
 */
async function emettreAvoirCoffret(order: ShopifyOrderWebhook) {
  // Le coffret est reconnu par son handle, pas par un identifiant en dur :
  // recréer le produit dans Shopify ne doit pas casser l'avoir en silence.
  let coffretAchete = false;
  try {
    const produits = await getAllProducts();
    const ids = new Set(
      produits
        .filter((p) => p.handle === COFFRET_HANDLE)
        .map((p) => Number(p.id.split("/").pop()))
        .filter(Number.isFinite)
    );
    coffretAchete = (order.line_items ?? []).some((li) => li.product_id && ids.has(li.product_id));
  } catch (error) {
    console.error("[avoir-coffret] catalogue injoignable :", error);
    return;
  }
  if (!coffretAchete) return;
  if (!AVOIR_SEL) {
    console.warn("[avoir-coffret] ni COFFRET_CREDIT_SALT ni SHOPIFY_WEBHOOK_SECRET : avoir non émis.");
    return;
  }

  const code = codeAvoir(order.id!, AVOIR_SEL);
  const fin = finValidite();
  const devise = order.currency ?? "AED";
  const produits = await idsProduits(REFLETS);
  const etat = await creerAvoir({
    code,
    montant: AVOIR_AED,
    devise,
    minimum: MINIMUM_AED,
    produits,
    fin,
    titre: `Avoir coffret découverte — commande ${order.name ?? order.id}`,
  });
  if (etat === "impossible") return;

  const email = (order.email ?? order.contact_email ?? "").trim();
  if (!email || !KLAVIYO_API_KEY) {
    console.warn(`[avoir-coffret] ${code} ${etat}, mais non remis (email ou clé Klaviyo manquants).`);
    return;
  }

  try {
    const res = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            properties: {
              code,
              amount: AVOIR_AED,
              currency: devise,
              minimum: MINIMUM_AED,
              expires_at: fin.toISOString(),
              valid_days: VALIDITE_JOURS,
              order_name: order.name ?? null,
            },
            value: AVOIR_AED,
            unique_id: `coffret-credit:${order.id}`,
            metric: { data: { type: "metric", attributes: { name: "Coffret Credit Issued" } } },
            profile: { data: { type: "profile", attributes: { email } } },
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("[avoir-coffret] Klaviyo :", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return;
    }
  } catch (error) {
    console.error("[avoir-coffret] Klaviyo injoignable :", error);
    return;
  }
  console.info(`[avoir-coffret] ${code} ${etat} pour la commande ${order.name ?? order.id}.`);
}

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
  name?: string;
  test?: boolean;
  email?: string | null;
  contact_email?: string | null;
  financial_status?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  payment_gateway_names?: string[];
  total_price?: string;
  subtotal_price?: string;
  total_discounts?: string;
  total_shipping_price_set?: { shop_money?: { amount?: string } } | null;
  currency?: string;
  customer_locale?: string | null;
  source_name?: string | null;
  referring_site?: string | null;
  landing_site?: string | null;
  discount_codes?: { code?: string }[];
  processed_at?: string | null;
  created_at?: string | null;
  order_status_url?: string | null;
  line_items?: {
    variant_id?: number | null;
    product_id?: number | null;
    title?: string;
    variant_title?: string | null;
    sku?: string | null;
    quantity?: number;
    price?: string;
    total_discount?: string;
  }[];
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  billing_address?: { phone?: string | null; country_code?: string | null } | null;
  shipping_address?: { country_code?: string | null } | null;
  client_details?: { browser_ip?: string | null; user_agent?: string | null } | null;
  note_attributes?: { name?: string; value?: string }[];
};

// L'identifiant anonyme du parcours (cookie mr_anon, voir lib/site-events.ts) : même garde-fou que /api/site-events.
const ANON_RE = /^[A-Za-z0-9_-]{8,64}$/;
const hostOf = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
};
const money = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * La commande dans notre table shop_orders, pour la tour de contrôle (CA,
 * panier moyen, par Reflet, sources, paniers abandonnés qui finissent payés).
 * Sans donnée personnelle — ni email, ni nom, ni adresse — et idempotent (upsert
 * sur l'id Shopify : les rejeux du webhook ne comptent rien deux fois). Les
 * commandes de test sont gardées, marquées `test`, écartées des chiffres.
 * Jamais bloquant : un échec ici ne doit pas empêcher Meta/GA4 ni faire rejouer.
 */
async function persistOrder(order: ShopifyOrderWebhook): Promise<void> {
  if (!order.id) return;
  let handles = new Map<number, string>();
  try {
    for (const p of await getAllProducts()) {
      const id = Number(p.id.split("/").pop());
      if (id) handles.set(id, p.handle);
    }
  } catch {
    handles = new Map();
  }
  let anon: string | null = null;
  let ga: string | null = null;
  // Le panier est-il né hors production (staging, preview, local) ? Alors la commande est une donnée de test.
  let fromTest = false;
  for (const attr of order.note_attributes ?? []) {
    const value = (attr.value ?? "").trim();
    if (attr.name === "mr_anon" && ANON_RE.test(value)) anon = value;
    if (attr.name === "_ga" && GA4_CLIENT_ID_RE.test(value)) ga = value;
    if (attr.name === "mr_env" && value) fromTest = isTestHost(value);
  }
  const lines = (order.line_items ?? []).map((li) => {
    const quantity = li.quantity ?? 1;
    const price = money(li.price);
    return {
      variant_id: li.variant_id ?? null,
      product_id: li.product_id ?? null,
      handle: li.product_id ? handles.get(li.product_id) ?? null : null,
      title: li.title ?? "",
      variant_title: li.variant_title ?? null,
      sku: li.sku ?? null,
      quantity,
      price,
      total: Math.max(0, price * quantity - money(li.total_discount)),
    };
  });
  const row = {
    id: order.id,
    name: order.name ?? null,
    created_at: order.created_at ?? new Date().toISOString(),
    processed_at: order.processed_at ?? null,
    test: Boolean(order.test) || fromTest,
    financial_status: order.financial_status ?? null,
    currency: order.currency ?? null,
    total: money(order.total_price),
    subtotal: money(order.subtotal_price),
    discounts: money(order.total_discounts),
    shipping: money(order.total_shipping_price_set?.shop_money?.amount),
    country: order.shipping_address?.country_code ?? order.billing_address?.country_code ?? null,
    locale: order.customer_locale ?? null,
    source_name: order.source_name ?? null,
    referring_site: hostOf(order.referring_site),
    landing_site: order.landing_site?.slice(0, 500) ?? null,
    discount_codes: (order.discount_codes ?? []).map((d) => d.code).filter((c): c is string => Boolean(c)),
    lines,
    anon_id: anon,
    ga_client: ga,
    cancelled_at: order.cancelled_at ?? null,
    gateway: (order.payment_gateway_names ?? []).filter(Boolean).join(", ") || null,
  };
  // Seules les colonnes fournies sont écrites : les remboursements déjà posés restent.
  const { error } = await adminDb().from("shop_orders").upsert(row, { onConflict: "id" });
  if (error) console.error("[webhooks/shopify-orders] shop_orders :", error.message);
}

// Le payload refunds/create : le remboursement, pas la commande.
type ShopifyRefundWebhook = {
  id?: number;
  order_id?: number;
  created_at?: string | null;
  transactions?: { amount?: string; kind?: string; status?: string }[];
  refund_line_items?: { subtotal?: string }[];
};

/**
 * Un remboursement s'ajoute à la commande (colonne refunds, [{id, amount, at}]) ;
 * le chiffre net de la tour de contrôle = total − remboursements. Idempotent
 * sur l'id du remboursement (rejeux Shopify). Une commande inconnue (passée
 * avant le webhook) est simplement ignorée.
 */
async function recordRefund(refund: ShopifyRefundWebhook): Promise<void> {
  if (!refund.id || !refund.order_id) return;
  const fromTransactions = (refund.transactions ?? []).filter((t) => t.kind === "refund" && (t.status ?? "success") === "success").reduce((n, t) => n + money(t.amount), 0);
  const amount = fromTransactions || (refund.refund_line_items ?? []).reduce((n, l) => n + money(l.subtotal), 0);
  const db = adminDb();
  const { data, error } = await db.from("shop_orders").select("refunds").eq("id", refund.order_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    console.warn(`[webhooks/shopify-orders] remboursement ${refund.id} pour une commande inconnue (${refund.order_id}).`);
    return;
  }
  const refunds: { id: number; amount: number; at: string }[] = Array.isArray(data.refunds) ? data.refunds : [];
  if (refunds.some((r) => r.id === refund.id)) return;
  refunds.push({ id: refund.id, amount, at: refund.created_at ?? new Date().toISOString() });
  const { error: upError } = await db.from("shop_orders").update({ refunds }).eq("id", refund.order_id);
  if (upError) throw new Error(upError.message);
}

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
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: true, skipped: "corps illisible" }, 200);
  }

  // Remboursement : la tour de contrôle seulement (chiffre net).
  if (topic === "refunds/create") {
    try {
      await recordRefund(payload as ShopifyRefundWebhook);
    } catch (error) {
      console.error("[webhooks/shopify-orders] remboursement :", error);
    }
    return json({ ok: true, topic }, 200);
  }
  // Annulation : la commande complète revient avec cancelled_at ; on la (re)pose telle quelle.
  if (topic === "orders/cancelled") {
    const cancelled = payload as ShopifyOrderWebhook;
    if (!cancelled.id) return json({ ok: true, skipped: "commande sans id" }, 200);
    try {
      await persistOrder(cancelled);
    } catch (error) {
      console.error("[webhooks/shopify-orders] annulation :", error);
    }
    return json({ ok: true, topic }, 200);
  }
  if (topic !== "orders/paid") {
    return json({ ok: true, skipped: `topic ${topic ?? "inconnu"}` }, 200);
  }

  const order = payload as ShopifyOrderWebhook;
  if (!order.id) return json({ ok: true, skipped: "commande sans id" }, 200);

  // La tour de contrôle d'abord : la commande est posée chez nous quoi qu'il
  // arrive ensuite côté Meta/GA4 (et même sans tracker configuré).
  try {
    await persistOrder(order);
  } catch (error) {
    console.error("[webhooks/shopify-orders] shop_orders :", error);
  }

  /*
   * L'avoir du coffret part AVANT les garde-fous publicitaires : il est dû au
   * client, que Meta et GA4 soient configurés ou non. Seules les commandes de
   * test en sont exclues.
   */
  if (!order.test) {
    try {
      await emettreAvoirCoffret(order);
    } catch (error) {
      console.error("[webhooks/shopify-orders] avoir coffret :", error);
    }
  }

  const metaConfigured = Boolean(PIXEL_ID && ACCESS_TOKEN);
  const ga4Configured = Boolean(GA4_MEASUREMENT_ID && GA4_API_SECRET);
  // Aucun tracker configuré : acquitter sans relayer (mode placeholder — le
  // webhook peut être branché avant les clés Meta/GA4).
  if (!metaConfigured && !ga4Configured) {
    console.warn("[webhooks/shopify-orders] Aucun tracker configuré — Purchase non relayé.");
    return json({ ok: true, skipped: "aucun tracker configuré" }, 200);
  }

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

  // _fbp/_fbc/_ga posés en attributs de panier par cart.ts, revenus avec la
  // commande — format validé avant relais (attributs falsifiables côté client).
  let ga4ClientId: string | null = null;
  for (const attr of order.note_attributes ?? []) {
    const value = attr.value ?? "";
    if (attr.name === "_ga" && GA4_CLIENT_ID_RE.test(value)) {
      ga4ClientId = value;
      continue;
    }
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

  // Un 5xx sur l'un OU l'autre déclenche un rejeu Shopify du webhook entier —
  // sans risque, les deux sont idempotents (event_id pour Meta, transaction_id
  // pour GA4), un rejeu ne compte jamais la vente en double.
  let hardFailure = false;

  if (metaConfigured) {
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
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          "[webhooks/shopify-orders] Meta a refusé le Purchase :",
          res.status,
          detail.slice(0, 500)
        );
        // 4xx Meta = configuration (token invalide, payload refusé) : rejouer
        // ne changera rien. 5xx = incident passager, on redemande un rejeu.
        if (res.status >= 500) hardFailure = true;
      }
    } catch (error) {
      console.error("[webhooks/shopify-orders] Meta injoignable :", error);
      hardFailure = true;
    }
  }

  // GA4 exige un client_id — sans lui (Pixel jamais chargé ET jamais bloqué
  // détecté, cas rare : panier créé avant l'activation de GA4_MEASUREMENT_ID)
  // impossible de rattacher la vente à une session, on n'envoie rien plutôt
  // que d'inventer un id qui créerait un profil GA4 fantôme.
  if (ga4Configured && ga4ClientId) {
    const ga4Payload = {
      client_id: ga4ClientId,
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: String(order.id),
            value,
            currency: order.currency ?? "AED",
            items: contents.map((c) => ({ item_id: c.id, quantity: c.quantity, price: c.item_price })),
          },
        },
      ],
    };

    try {
      const res = await fetch(
        `${GA4_COLLECT_URL}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ga4Payload),
        }
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          "[webhooks/shopify-orders] GA4 a refusé le Purchase :",
          res.status,
          detail.slice(0, 500)
        );
        if (res.status >= 500) hardFailure = true;
      } else if (GA4_DEBUG_MODE) {
        const detail = await res.text().catch(() => "");
        console.warn("[webhooks/shopify-orders] Validation GA4 :", detail.slice(0, 1000));
      }
    } catch (error) {
      console.error("[webhooks/shopify-orders] GA4 injoignable :", error);
      hardFailure = true;
    }
  }

  if (hardFailure) {
    return json({ ok: false, error: "Tracker indisponible, rejeu demandé." }, 502);
  }
  return json({ ok: true }, 200);
};
