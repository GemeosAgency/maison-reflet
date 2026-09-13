/**
 * Le business vu depuis le site : les commandes (shop_orders, posées par le
 * webhook Shopify) croisées avec les parcours anonymes (site_events). Tout se
 * calcule en mémoire à partir de deux jeux de lignes : les VISITEURS (un profil
 * par identifiant anonyme : source d'arrivée, pays, appareil, ce qu'il a vu,
 * son sac, son dernier départ en paiement) et les COMMANDES. Les filtres
 * (produit, pays, source, langue) s'appliquent aux deux, et chaque chiffre en
 * découle. La période précédente est calculée de la même façon pour les
 * comparaisons. Les détails (par produit, par source, par pays, jour par jour)
 * nourrissent les fenêtres qui s'ouvrent au clic.
 */
import { adminDb } from "./db";
import { COUNTRY_CENTROIDS, countryName } from "./geo";
import { LAYERING } from "../layering";
import { getAllProducts, isCoffret, isSampleVariantTitle } from "../shopify";
import { dailySeries, dayKey, daysOf, fetchAll, loadSite, previousRange, rangeBetween, refletNames, TZ, type Range, type SiteEventRow } from "./data";

/* ------------------------------------------------------------------ types */
export type OrderLine = { variant_id: number | null; product_id: number | null; handle: string | null; title: string; variant_title: string | null; sku: string | null; quantity: number; price: number; total: number };
export type OrderRow = {
  id: number;
  name: string | null;
  created_at: string;
  processed_at: string | null;
  test: boolean;
  financial_status: string | null;
  currency: string | null;
  total: number;
  subtotal: number;
  discounts: number;
  shipping: number;
  country: string | null;
  locale: string | null;
  source_name: string | null;
  referring_site: string | null;
  landing_site: string | null;
  discount_codes: string[];
  lines: OrderLine[];
  anon_id: string | null;
  ga_client: string | null;
  received_at: string;
};

export type Product = { handle: string; name: string; image: string | null; price: number; kind: "reflet" | "coffret"; productId: number | null };
export type Catalog = { products: Product[]; variantPrice: Map<string, { price: number; handle: string }>; handlePrice: Map<string, number>; byProductId: Map<number, string> };
/** Une vignette Shopify à la largeur voulue (le CDN redimensionne à la demande). */
export const thumb = (url: string | null | undefined, w = 160) => (url ? `${url}${url.includes("?") ? "&" : "?"}width=${w}` : null);

export type Source = { label: string; channel: Channel };
export type Channel = "Direct" | "Social" | "Payant" | "Recherche" | "Email" | "Référent" | "Inconnue";
export const CHANNEL_COLORS: Record<Channel, string> = {
  Direct: "#150e0a",
  Social: "#812538",
  Payant: "#b4536a",
  Recherche: "#3f6b4f",
  Email: "#a8641e",
  Référent: "#7a6f66",
  Inconnue: "#cfc6b8",
};

export type CartLine = { handle: string; quantity: number; amount: number };
export type Visitor = {
  anon: string;
  country: string | null;
  locale: string | null;
  device: "mobile" | "desktop" | null;
  source: Source;
  landingPath: string | null;
  firstSeen: string;
  lastSeen: string;
  pageViews: number;
  viewed: Set<string>;
  cartAt: string | null;
  addedTotal: number | null;
  addedLines: CartLine[];
  addedVariants: string[];
  checkout: { at: string; total: number; currency: string | null; lines: CartLine[] } | null;
  orders: OrderRow[];
};

export type Filters = { reflet?: string; country?: string; source?: string; locale?: string };
export function parseFilters(params: URLSearchParams): Filters {
  const pick = (k: string, re: RegExp) => {
    const v = params.get(k)?.trim();
    return v && re.test(v) ? v : undefined;
  };
  return {
    reflet: pick("reflet", /^[a-z0-9-]{2,60}$/),
    country: pick("country", /^[A-Z]{2}$/),
    source: pick("source", /^[\p{L}\p{N} .-]{2,40}$/u),
    locale: pick("locale", /^(fr|en|ar)$/),
  };
}
export const hasFilters = (f: Filters) => Boolean(f.reflet || f.country || f.source || f.locale);
export function filtersQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.reflet) p.set("reflet", f.reflet);
  if (f.country) p.set("country", f.country);
  if (f.source) p.set("source", f.source);
  if (f.locale) p.set("locale", f.locale);
  const s = p.toString();
  return s ? `&${s}` : "";
}

/* ------------------------------------------------------------------ helpers */
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const cartLines = (v: unknown): CartLine[] =>
  Array.isArray(v)
    ? v
        .map((l) => (l && typeof l === "object" ? { handle: str((l as any).handle) ?? "", quantity: num((l as any).quantity) ?? 1, amount: num((l as any).amount) ?? 0 } : null))
        .filter((l): l is CartLine => Boolean(l && l.handle))
    : [];

export const fmtMoney = (n: number, currency = "AED") => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n))} ${currency}`;
export const fmtMoneyShort = (n: number) => (n >= 100000 ? `${(n / 1000).toFixed(0)} k` : n >= 10000 ? `${(n / 1000).toFixed(1).replace(".", ",")} k` : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)));
export const flagOf = (code: string | null | undefined) => (code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");
/** La variation en % entre deux valeurs (null si rien à comparer). */
export function delta(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / prev;
}

/** D'où vient une visite : la source utm si elle existe, sinon le site d'où l'on vient, sinon direct. */
export function classifySource(ref: string | null, utm: { source?: string; medium?: string } | null): Source {
  const s = (utm?.source ?? "").toLowerCase();
  const m = (utm?.medium ?? "").toLowerCase();
  if (s) {
    const paid = /cpc|ppc|paid|ads?$|display|retarget/.test(m);
    if (/instagram|^ig$/.test(s)) return { label: paid ? "Instagram Ads" : "Instagram", channel: paid ? "Payant" : "Social" };
    if (/facebook|^fb$|meta/.test(s)) return { label: paid ? "Meta Ads" : "Facebook", channel: paid ? "Payant" : "Social" };
    if (/tiktok/.test(s)) return { label: paid ? "TikTok Ads" : "TikTok", channel: paid ? "Payant" : "Social" };
    if (/snap/.test(s)) return { label: paid ? "Snapchat Ads" : "Snapchat", channel: paid ? "Payant" : "Social" };
    if (/google/.test(s)) return { label: paid ? "Google Ads" : "Google", channel: paid ? "Payant" : "Recherche" };
    if (/klaviyo|email|newsletter|mail/.test(s) || /email|sms/.test(m)) return { label: /sms/.test(m) ? "SMS" : "Email", channel: "Email" };
    if (/whatsapp/.test(s)) return { label: "WhatsApp", channel: "Social" };
    if (/youtube/.test(s)) return { label: "YouTube", channel: "Social" };
    if (/influen|creator|ugc/.test(m) || /influen/.test(s)) return { label: "Influence", channel: "Social" };
    return { label: s.charAt(0).toUpperCase() + s.slice(1, 30), channel: paid ? "Payant" : "Référent" };
  }
  if (ref) {
    const h = ref.toLowerCase();
    if (/instagram\.com$/.test(h)) return { label: "Instagram", channel: "Social" };
    if (/facebook\.com$|fb\.com$|messenger\.com$/.test(h)) return { label: "Facebook", channel: "Social" };
    if (/tiktok\.com$/.test(h)) return { label: "TikTok", channel: "Social" };
    if (/snapchat\.com$/.test(h)) return { label: "Snapchat", channel: "Social" };
    if (/^google\.|\.google\./.test(h)) return { label: "Google", channel: "Recherche" };
    if (/bing\.com$/.test(h)) return { label: "Bing", channel: "Recherche" };
    if (/duckduckgo|ecosia|yahoo|yandex/.test(h)) return { label: "Autre moteur", channel: "Recherche" };
    if (/^t\.co$|twitter\.com$|^x\.com$/.test(h)) return { label: "X", channel: "Social" };
    if (/youtube\.com$|youtu\.be$/.test(h)) return { label: "YouTube", channel: "Social" };
    if (/pinterest/.test(h)) return { label: "Pinterest", channel: "Social" };
    if (/linkedin\.com$/.test(h)) return { label: "LinkedIn", channel: "Social" };
    if (/whatsapp\.com$/.test(h)) return { label: "WhatsApp", channel: "Social" };
    if (/klaviyo|klclick|mailchimp/.test(h)) return { label: "Email", channel: "Email" };
    if (/shopify\.com$|shop\.app$|myshopify\.com$/.test(h)) return { label: "Shopify", channel: "Référent" };
    if (/maisonreflet\.com$/.test(h)) return { label: "Direct", channel: "Direct" };
    return { label: h.replace(/^(m|l|lm)\./, ""), channel: "Référent" };
  }
  return { label: "Direct", channel: "Direct" };
}

/** La source d'une commande quand son parcours est inconnu : le landing_site Shopify porte les utm, referring_site le site d'origine. */
function orderSource(o: OrderRow): Source {
  let utm: { source?: string; medium?: string } | null = null;
  if (o.landing_site) {
    try {
      const u = new URL(o.landing_site, "https://maisonreflet.com");
      const source = u.searchParams.get("utm_source") ?? undefined;
      const medium = u.searchParams.get("utm_medium") ?? undefined;
      if (source) utm = { source, medium };
    } catch {
      utm = null;
    }
  }
  if (!utm && !o.referring_site) return { label: "Inconnue", channel: "Inconnue" };
  return classifySource(o.referring_site, utm);
}

/* ------------------------------------------------------------------ lecture */
export async function loadOrders(range: Range): Promise<OrderRow[]> {
  try {
    const rows = await fetchAll<OrderRow>("shop_orders", (q) => q.gte("created_at", range.from.toISOString()).lte("created_at", range.to.toISOString()).order("created_at", { ascending: false }));
    return rows.map((r) => ({ ...r, total: Number(r.total), subtotal: Number(r.subtotal), discounts: Number(r.discounts), shipping: Number(r.shipping), lines: Array.isArray(r.lines) ? r.lines : [] }));
  } catch (error) {
    console.error("[admin/business] shop_orders", error);
    return [];
  }
}

/** Le catalogue Shopify : les six Reflets et les coffrets, avec image et prix, pour les vignettes et les estimations. */
export async function loadCatalog(): Promise<Catalog> {
  const products: Product[] = [];
  const variantPrice = new Map<string, { price: number; handle: string }>();
  const handlePrice = new Map<string, number>();
  const byProductId = new Map<number, string>();
  try {
    for (const p of await getAllProducts()) {
      const productId = Number(p.id.split("/").pop()) || null;
      if (productId) byProductId.set(productId, p.handle);
      for (const v of p.variants.nodes) {
        const price = Number(v.price.amount);
        variantPrice.set(v.id, { price, handle: p.handle });
        if (price > 0 && !isSampleVariantTitle(v.title) && !handlePrice.has(p.handle)) handlePrice.set(p.handle, price);
      }
      products.push({ handle: p.handle, name: p.title, image: p.featuredImage?.url ?? null, price: handlePrice.get(p.handle) ?? Number(p.priceRange.minVariantPrice.amount), kind: isCoffret(p) ? "coffret" : "reflet", productId });
    }
  } catch (error) {
    console.error("[admin/business] catalogue Shopify indisponible", error);
    for (const h of [...new Set(LAYERING.flatMap((d) => d.pair))]) products.push({ handle: h, name: h, image: null, price: 0, kind: "reflet", productId: null });
  }
  products.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "reflet" ? -1 : 1));
  return { products, variantPrice, handlePrice, byProductId };
}

/* ------------------------------------------------------------------ visiteurs & paniers */
export function buildVisitors(events: SiteEventRow[], orders: OrderRow[]): Map<string, Visitor> {
  const byAnon = new Map<string, Visitor>();
  for (const e of events) {
    let v = byAnon.get(e.anon_id);
    if (!v) {
      v = { anon: e.anon_id, country: null, locale: null, device: null, source: { label: "Avant le suivi", channel: "Inconnue" }, landingPath: null, firstSeen: e.created_at, lastSeen: e.created_at, pageViews: 0, viewed: new Set(), cartAt: null, addedTotal: null, addedLines: [], addedVariants: [], checkout: null, orders: [] };
      byAnon.set(e.anon_id, v);
    }
    v.country ??= e.country;
    v.locale ??= e.locale;
    if (e.created_at > v.lastSeen) v.lastSeen = e.created_at;
    if (e.created_at < v.firstSeen) v.firstSeen = e.created_at;
    switch (e.name) {
      case "page_view": {
        v.pageViews++;
        const device = str(e.props.device);
        if (device === "mobile" || device === "desktop") v.device ??= device;
        if (e.props.landing === true && v.source.channel === "Inconnue") {
          const utm = e.props.utm && typeof e.props.utm === "object" ? (e.props.utm as { source?: string; medium?: string }) : null;
          v.source = classifySource(str(e.props.ref), utm);
          v.landingPath = e.path;
        }
        break;
      }
      case "product_view": {
        const h = str(e.props.handle);
        if (h) v.viewed.add(h);
        break;
      }
      case "add_to_cart": {
        if (!v.cartAt || e.created_at > v.cartAt) v.cartAt = e.created_at;
        const t = num(e.props.total);
        if (t !== null) v.addedTotal = t;
        for (const gid of Array.isArray(e.props.variants) ? e.props.variants : []) if (typeof gid === "string") v.addedVariants.push(gid);
        const lines = cartLines(e.props.lines);
        if (lines.length) v.addedLines = lines;
        else for (const h of Array.isArray(e.props.handles) ? e.props.handles : []) if (typeof h === "string" && !v.addedLines.some((l) => l.handle === h)) v.addedLines.push({ handle: h, quantity: 1, amount: 0 });
        break;
      }
      case "checkout": {
        const t = num(e.props.total) ?? 0;
        if (!v.checkout || e.created_at > v.checkout.at) v.checkout = { at: e.created_at, total: t, currency: str(e.props.currency), lines: cartLines(e.props.lines) };
        break;
      }
    }
  }
  for (const o of orders) {
    if (!o.anon_id) continue;
    const v = byAnon.get(o.anon_id);
    if (v) v.orders.push(o);
  }
  return byAnon;
}

export type Cart = { stage: "cart" | "checkout"; at: string; total: number; currency: string | null; lines: CartLine[]; estimated: boolean };
/** Le panier d'un visiteur : son départ en paiement s'il y en a un, sinon son sac ; montant de l'événement, sinon estimé d'après le catalogue. */
export function cartOf(v: Visitor, catalog: Catalog): Cart | null {
  if (v.checkout) return { stage: "checkout", at: v.checkout.at, total: v.checkout.total, currency: v.checkout.currency, lines: v.checkout.lines, estimated: false };
  if (!v.cartAt) return null;
  if (v.addedTotal !== null) return { stage: "cart", at: v.cartAt, total: v.addedTotal, currency: null, lines: v.addedLines, estimated: false };
  const byHandle = new Map<string, CartLine>();
  for (const gid of v.addedVariants) {
    const p = catalog.variantPrice.get(gid);
    if (!p || p.price <= 0) continue;
    const cur = byHandle.get(p.handle) ?? { handle: p.handle, quantity: 0, amount: 0 };
    cur.quantity++;
    cur.amount += p.price;
    byHandle.set(p.handle, cur);
  }
  for (const l of v.addedLines) if (!byHandle.has(l.handle)) byHandle.set(l.handle, { handle: l.handle, quantity: l.quantity, amount: (catalog.handlePrice.get(l.handle) ?? 0) * l.quantity });
  const lines = [...byHandle.values()];
  return { stage: "cart", at: v.cartAt, total: lines.reduce((n, l) => n + l.amount, 0), currency: null, lines, estimated: true };
}

const ONE_HOUR = 3600 * 1000;
export type CartStatus = "paid" | "open" | "abandoned";
export function cartStatus(v: Visitor, cart: Cart | null, now = Date.now()): CartStatus | null {
  if (!cart) return null;
  const at = new Date(cart.at).getTime();
  if (v.orders.some((o) => new Date(o.created_at).getTime() >= at - 10 * 60 * 1000)) return "paid";
  return now - at < ONE_HOUR ? "open" : "abandoned";
}

/* ------------------------------------------------------------------ le business */
export type Item = { handle: string | null; name: string; image: string | null; quantity: number; amount?: number };
export type RecentOrder = { id: number; name: string | null; created_at: string; country: string | null; total: number; discounts: number; currency: string; source: Source; source_name: string | null; discount_codes: string[]; items: Item[]; linked: boolean };
export type CartRow = { anon: string; at: string; stage: Cart["stage"]; estimated: boolean; total: number; currency: string; items: Item[]; country: string | null; source: string; device: Visitor["device"]; status: CartStatus };
export type Kpis = {
  revenue: number;
  orders: number;
  aov: number | null;
  units: number;
  discounts: number;
  shipping: number;
  visitors: number;
  conversion: number | null;
  checkoutRate: number | null;
  checkouts: number;
  abandonedCount: number;
  abandonedTotal: number;
  cartsTotal: number;
  cartsCount: number;
  /** Visiteurs distincts ayant mis au moins un produit au sac, et leur part. */
  adders: number;
  addRate: number | null;
  /** Acheteurs distincts (un parcours qui commande deux fois compte une fois), et le chiffre par acheteur. */
  buyers: number;
  aovPerBuyer: number | null;
  /** La valeur moyenne d'un panier, payé ou non. */
  avgCart: number | null;
  /** Ce que vaut une visite : chiffre d'affaires divisé par les visiteurs. */
  revenuePerVisitor: number | null;
};

type Ctx = { events: SiteEventRow[]; orders: OrderRow[]; catalog: Catalog; range: Range; filters: Filters };

/** Le socle : visiteurs et commandes filtrés, paniers, indicateurs. Suffit pour la période de comparaison. */
function core({ events, orders: allOrders, catalog, range, filters: f }: Ctx) {
  const products = catalog.products;
  const productOf = (h: string | null) => products.find((p) => p.handle === h) ?? null;
  const handleOf = (line: OrderLine) => line.handle ?? (line.product_id ? catalog.byProductId.get(line.product_id) : null) ?? products.find((p) => p.name === line.title)?.handle ?? null;
  const itemOf = (handle: string | null, title: string, quantity: number, amount?: number): Item => {
    const p = productOf(handle);
    return { handle, name: p?.name ?? title, image: p?.image ?? null, quantity, amount };
  };
  const realOrders = allOrders.filter((o) => !o.test);
  const visitorsAll = buildVisitors(events, realOrders);
  const sourceOf = (o: OrderRow): Source => {
    const v = o.anon_id ? visitorsAll.get(o.anon_id) : undefined;
    return v && v.source.channel !== "Inconnue" ? v.source : orderSource(o);
  };

  const facets = {
    countries: [...new Set([...[...visitorsAll.values()].map((v) => v.country), ...realOrders.map((o) => o.country)])].filter((c): c is string => Boolean(c)).sort(),
    sources: [...new Set([...[...visitorsAll.values()].map((v) => v.source.label), ...realOrders.map((o) => sourceOf(o).label)])].sort(),
    products,
  };

  const keepVisitor = (v: Visitor) =>
    (!f.reflet || v.viewed.has(f.reflet) || v.addedLines.some((l) => l.handle === f.reflet) || v.checkout?.lines.some((l) => l.handle === f.reflet) || v.orders.some((o) => o.lines.some((l) => handleOf(l) === f.reflet))) &&
    (!f.country || v.country === f.country) &&
    (!f.source || v.source.label === f.source) &&
    (!f.locale || v.locale === f.locale);
  const keepOrder = (o: OrderRow) =>
    (!f.reflet || o.lines.some((l) => handleOf(l) === f.reflet)) &&
    (!f.country || o.country === f.country || (o.anon_id ? visitorsAll.get(o.anon_id)?.country === f.country : false)) &&
    (!f.source || sourceOf(o).label === f.source) &&
    (!f.locale || (o.locale ?? "").toLowerCase().startsWith(f.locale) || (o.anon_id ? visitorsAll.get(o.anon_id)?.locale === f.locale : false));
  const visitors = [...visitorsAll.values()].filter(keepVisitor);
  const orders = realOrders.filter(keepOrder);
  const visitorAnon = new Set(visitors.map((v) => v.anon));
  const ev = hasFilters(f) ? events.filter((e) => visitorAnon.has(e.anon_id)) : events;

  const currency = orders.find((o) => o.currency)?.currency ?? visitors.find((v) => v.checkout?.currency)?.checkout?.currency ?? "AED";
  const revenue = orders.reduce((n, o) => n + o.total, 0);
  const units = orders.reduce((n, o) => n + o.lines.reduce((m, l) => m + (l.total > 0 ? l.quantity : 0), 0), 0);

  // Les paniers.
  const now = Date.now();
  const cartsByAnon = new Map<string, Cart>();
  for (const v of visitors) {
    const c = cartOf(v, catalog);
    if (c) cartsByAnon.set(v.anon, c);
  }
  const withCart = visitors.filter((v) => cartsByAnon.has(v.anon));
  const withCheckout = withCart.filter((v) => cartsByAnon.get(v.anon)!.stage === "checkout");
  const statusOf = (v: Visitor) => cartStatus(v, cartsByAnon.get(v.anon) ?? null, now);
  const abandoned = withCart.filter((v) => statusOf(v) === "abandoned");
  const open = withCart.filter((v) => statusOf(v) === "open");
  const sum = (vs: Visitor[]) => vs.reduce((n, v) => n + (cartsByAnon.get(v.anon)?.total ?? 0), 0);
  const atCheckout = (vs: Visitor[]) => vs.filter((v) => cartsByAnon.get(v.anon)?.stage === "checkout");
  const abandonedTotal = sum(abandoned);
  const openTotal = sum(open);
  const carts = {
    paid: { count: orders.length, total: revenue },
    abandoned: { count: abandoned.length, total: abandonedTotal, atCheckout: atCheckout(abandoned).length, atCheckoutTotal: sum(atCheckout(abandoned)) },
    open: { count: open.length, total: openTotal, atCheckout: atCheckout(open).length },
    all: { count: orders.length + abandoned.length + open.length, total: revenue + abandonedTotal + openTotal },
    estimated: [...abandoned, ...open].filter((v) => cartsByAnon.get(v.anon)?.estimated).length,
    recoveryRate: withCart.length ? withCart.filter((v) => statusOf(v) === "paid").length / withCart.length : null,
    checkoutRecoveryRate: withCheckout.length ? withCheckout.filter((v) => statusOf(v) === "paid").length / withCheckout.length : null,
  };

  const adders = new Set(ev.filter((e) => e.name === "add_to_cart").map((e) => e.anon_id)).size;
  const buyers = new Set(orders.map((o) => o.anon_id ?? `commande:${o.id}`)).size;
  const kpis: Kpis = {
    revenue,
    orders: orders.length,
    aov: orders.length ? revenue / orders.length : null,
    units,
    discounts: orders.reduce((n, o) => n + o.discounts, 0),
    shipping: orders.reduce((n, o) => n + o.shipping, 0),
    visitors: visitors.length,
    conversion: visitors.length ? orders.length / visitors.length : null,
    checkoutRate: visitors.length ? withCheckout.length / visitors.length : null,
    checkouts: withCheckout.length,
    abandonedCount: abandoned.length,
    abandonedTotal,
    cartsTotal: carts.all.total,
    cartsCount: carts.all.count,
    adders,
    addRate: visitors.length ? adders / visitors.length : null,
    buyers,
    aovPerBuyer: buyers ? revenue / buyers : null,
    avgCart: carts.all.count ? carts.all.total / carts.all.count : null,
    revenuePerVisitor: visitors.length ? revenue / visitors.length : null,
  };
  return { products, productOf, handleOf, itemOf, visitorsAll, sourceOf, facets, keepOrder, visitors, orders, ev, currency, revenue, cartsByAnon, withCart, withCheckout, statusOf, abandoned, open, carts, kpis, events, allOrders, range };
}

/** Tout le reste : séries, jour par jour, produits, sources, pays, listes — pour la période regardée. */
function summarize(ctx: Ctx) {
  const { products, productOf, handleOf, itemOf, visitorsAll, sourceOf, facets, keepOrder, visitors, orders, ev, currency, revenue, cartsByAnon, withCart, withCheckout, statusOf, abandoned, open, carts, kpis, events, allOrders, range } = core(ctx);

  const toRecent = (o: OrderRow): RecentOrder => ({
    id: o.id,
    name: o.name,
    created_at: o.created_at,
    country: o.country,
    total: o.total,
    discounts: o.discounts,
    currency: o.currency ?? currency,
    source: sourceOf(o),
    source_name: o.source_name,
    discount_codes: o.discount_codes,
    items: o.lines.filter((l) => l.total > 0).map((l) => itemOf(handleOf(l), l.title, l.quantity, l.total)),
    linked: Boolean(o.anon_id && visitorsAll.has(o.anon_id)),
  });
  const toCartRow = (v: Visitor): CartRow => {
    const c = cartsByAnon.get(v.anon)!;
    return { anon: v.anon, at: c.at, stage: c.stage, estimated: c.estimated, total: c.total, currency: c.currency ?? currency, items: c.lines.map((l) => itemOf(l.handle, l.handle, l.quantity, l.amount)), country: v.country, source: v.source.label, device: v.device, status: statusOf(v) as CartStatus };
  };
  const recentOrders = orders.map(toRecent);
  const abandonedCarts = [...abandoned, ...open].map(toCartRow).sort((a, b) => (a.at < b.at ? 1 : -1));
  // Tous les paniers : les payés (par leur parcours, sinon par la commande elle-même), les abandonnés, les en cours.
  const paidAnon = new Set(withCart.filter((v) => statusOf(v) === "paid").map((v) => v.anon));
  const paidCarts: CartRow[] = [
    ...withCart.filter((v) => paidAnon.has(v.anon)).map(toCartRow),
    ...orders
      .filter((o) => !(o.anon_id && paidAnon.has(o.anon_id)))
      .map((o): CartRow => ({ anon: `commande:${o.id}`, at: o.created_at, stage: "checkout", estimated: false, total: o.total, currency: o.currency ?? currency, items: o.lines.filter((l) => l.total > 0).map((l) => itemOf(handleOf(l), l.title, l.quantity, l.total)), country: o.country, source: sourceOf(o).label, device: null, status: "paid" })),
  ];
  const allCarts = [...abandonedCarts, ...paidCarts].sort((a, b) => (a.at < b.at ? 1 : -1));

  // Les séries par jour.
  const sumByDay = (rows: { created_at: string; amount: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(dayKey(r.created_at), (m.get(dayKey(r.created_at)) ?? 0) + r.amount);
    return daysOf(range).map((d) => ({ key: d.key, label: d.label, value: Math.round(m.get(d.key) ?? 0) }));
  };
  const uniqueByDay = (rows: { created_at: string; anon_id: string }[]) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) m.set(dayKey(r.created_at), (m.get(dayKey(r.created_at)) ?? new Set()).add(r.anon_id));
    return daysOf(range).map((d) => ({ key: d.key, label: d.label, value: m.get(d.key)?.size ?? 0 }));
  };
  const series = {
    revenue: sumByDay(orders.map((o) => ({ created_at: o.created_at, amount: o.total }))),
    orders: dailySeries(orders, range),
    visitors: uniqueByDay(ev),
    checkouts: dailySeries(ev.filter((e) => e.name === "checkout"), range),
    abandoned: sumByDay(abandoned.map((v) => ({ created_at: cartsByAnon.get(v.anon)!.at, amount: cartsByAnon.get(v.anon)!.total }))),
  };
  const byDay = daysOf(range).map((d, i) => {
    const dayOrders = orders.filter((o) => dayKey(o.created_at) === d.key);
    const dayAbandoned = abandoned.filter((v) => dayKey(cartsByAnon.get(v.anon)!.at) === d.key);
    return {
      key: d.key,
      label: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d.date),
      visitors: series.visitors[i].value,
      views: ev.filter((e) => e.name === "product_view" && dayKey(e.created_at) === d.key).length,
      adds: ev.filter((e) => e.name === "add_to_cart" && dayKey(e.created_at) === d.key).length,
      checkouts: series.checkouts[i].value,
      orders: dayOrders.length,
      revenue: dayOrders.reduce((n, o) => n + o.total, 0),
      abandoned: dayAbandoned.length,
      abandonedTotal: dayAbandoned.reduce((n, v) => n + (cartsByAnon.get(v.anon)?.total ?? 0), 0),
    };
  });

  // Par produit (les Reflets et les coffrets), avec le détail pour la fenêtre.
  const perProduct = products.map((p) => {
    const lines = orders.flatMap((o) => o.lines.filter((l) => handleOf(l) === p.handle && l.total > 0).map((l) => ({ ...l, order: o })));
    const orderIds = new Set(lines.map((l) => l.order.id));
    const abandonedRows = abandonedCarts.filter((c) => c.status === "abandoned" && c.items.some((i) => i.handle === p.handle));
    const abandonedAmount = abandonedRows.reduce((n, c) => n + c.items.filter((i) => i.handle === p.handle).reduce((m, i) => m + (i.amount ?? 0), 0), 0);
    const viewEvents = ev.filter((e) => e.name === "product_view" && str(e.props.handle) === p.handle);
    const viewers = new Set(viewEvents.map((e) => e.anon_id)).size;
    const adds = ev.filter((e) => e.name === "add_to_cart" && Array.isArray(e.props.handles) && (e.props.handles as unknown[]).includes(p.handle)).length;
    const plays = ev.filter((e) => e.name === "audio_play" && str(e.props.id) === p.handle).length;
    const countriesMap = new Map<string, number>();
    for (const l of lines) {
      const code = l.order.country ?? (l.order.anon_id ? visitorsAll.get(l.order.anon_id)?.country : null) ?? null;
      if (code) countriesMap.set(code, (countriesMap.get(code) ?? 0) + l.quantity);
    }
    const productRevenue = lines.reduce((n, l) => n + l.total, 0);
    return {
      ...p,
      revenue: productRevenue,
      units: lines.reduce((n, l) => n + l.quantity, 0),
      orders: orderIds.size,
      abandoned: abandonedRows.length,
      abandonedTotal: abandonedAmount,
      views: viewers,
      plays,
      adds,
      share: revenue ? productRevenue / revenue : 0,
      detail: {
        seriesViews: dailySeries(viewEvents, range),
        seriesUnits: sumByDay(lines.map((l) => ({ created_at: l.order.created_at, amount: l.quantity }))),
        countries: [...countriesMap.entries()].map(([code, u]) => ({ code, name: countryName(code), flag: flagOf(code), units: u })).sort((a, b) => b.units - a.units).slice(0, 6),
        orders: recentOrders.filter((o) => orderIds.has(o.id)).slice(0, 8),
        carts: abandonedCarts.filter((c) => c.items.some((i) => i.handle === p.handle)).slice(0, 8),
      },
    };
  });
  perProduct.sort((a, b) => b.revenue - a.revenue || b.views - a.views);
  const otherLines = orders.flatMap((o) => o.lines.filter((l) => l.total > 0 && !products.some((p) => p.handle === handleOf(l))));
  const other = { revenue: otherLines.reduce((n, l) => n + l.total, 0), units: otherLines.reduce((n, l) => n + l.quantity, 0), titles: [...new Set(otherLines.map((l) => l.title))] };

  // Les campagnes utm.
  const campaigns = (() => {
    const m = new Map<string, { campaign: string; source: string; sourceLabel: string; visitors: number; orders: number; revenue: number }>();
    for (const e of ev) {
      if (e.name !== "page_view" || e.props.landing !== true) continue;
      const utm = e.props.utm && typeof e.props.utm === "object" ? (e.props.utm as Record<string, string>) : null;
      if (!utm?.campaign) continue;
      const key = `${utm.source ?? "?"}|${utm.campaign}`;
      const cur = m.get(key) ?? { campaign: utm.campaign, source: utm.source ?? "?", sourceLabel: classifySource(null, utm).label, visitors: 0, orders: 0, revenue: 0 };
      cur.visitors++;
      for (const o of visitorsAll.get(e.anon_id)?.orders ?? []) if (keepOrder(o)) {
        cur.orders++;
        cur.revenue += o.total;
      }
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  })();

  // Les sources et les canaux, avec le détail.
  const sourceMap = new Map<string, { label: string; channel: Channel; color: string; visitors: number; orders: number; revenue: number; checkouts: number; visitorsList: Visitor[]; ordersList: RecentOrder[] }>();
  const bump = (s: Source) => {
    const cur = sourceMap.get(s.label) ?? { label: s.label, channel: s.channel, color: CHANNEL_COLORS[s.channel], visitors: 0, orders: 0, revenue: 0, checkouts: 0, visitorsList: [], ordersList: [] };
    sourceMap.set(s.label, cur);
    return cur;
  };
  for (const v of visitors) {
    const cur = bump(v.source);
    cur.visitors++;
    cur.visitorsList.push(v);
    if (v.checkout) cur.checkouts++;
  }
  for (const o of recentOrders) {
    const cur = bump(o.source);
    cur.orders++;
    cur.revenue += o.total;
    cur.ordersList.push(o);
  }
  const top = <T,>(rows: T[], key: (r: T) => string | null, n: number) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, n);
  };
  const sources = [...sourceMap.values()]
    .map(({ visitorsList, ordersList, ...s }) => ({
      ...s,
      conversion: s.visitors ? s.orders / s.visitors : null,
      detail: {
        orders: ordersList.slice(0, 8),
        landingPages: top(visitorsList, (v) => v.landingPath, 6),
        countries: top(visitorsList, (v) => v.country, 6).map((c) => ({ ...c, name: countryName(c.label), flag: flagOf(c.label) })),
        devices: top(visitorsList, (v) => (v.device === "mobile" ? "Mobile" : v.device === "desktop" ? "Ordinateur" : null), 2),
        campaigns: campaigns.filter((c) => c.sourceLabel === s.label),
        viewed: top(visitorsList.flatMap((v) => [...v.viewed]), (h) => productOf(h)?.name ?? h, 6),
      },
    }))
    .sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  const channels = (["Direct", "Social", "Payant", "Recherche", "Email", "Référent", "Inconnue"] as Channel[])
    .map((channel) => ({ channel, color: CHANNEL_COLORS[channel], visitors: sources.filter((s) => s.channel === channel).reduce((n, s) => n + s.visitors, 0), orders: sources.filter((s) => s.channel === channel).reduce((n, s) => n + s.orders, 0), revenue: sources.filter((s) => s.channel === channel).reduce((n, s) => n + s.revenue, 0) }))
    .filter((c) => c.visitors > 0 || c.orders > 0);

  // Les pays, avec le détail.
  const countryMap = new Map<string, { code: string; name: string; flag: string; visitors: number; orders: number; revenue: number; visitorsList: Visitor[]; ordersList: RecentOrder[] }>();
  const bumpCountry = (code: string) => {
    const cur = countryMap.get(code) ?? { code, name: countryName(code), flag: flagOf(code), visitors: 0, orders: 0, revenue: 0, visitorsList: [], ordersList: [] };
    countryMap.set(code, cur);
    return cur;
  };
  for (const v of visitors) if (v.country) {
    const cur = bumpCountry(v.country);
    cur.visitors++;
    cur.visitorsList.push(v);
  }
  for (const o of recentOrders) {
    const code = o.country ?? (orders.find((x) => x.id === o.id)?.anon_id ? visitorsAll.get(orders.find((x) => x.id === o.id)!.anon_id!)?.country : null) ?? null;
    if (!code) continue;
    const cur = bumpCountry(code);
    cur.orders++;
    cur.revenue += o.total;
    cur.ordersList.push(o);
  }
  const countries = [...countryMap.values()]
    .map(({ visitorsList, ordersList, ...c }) => ({
      ...c,
      conversion: c.visitors ? c.orders / c.visitors : null,
      detail: {
        orders: ordersList.slice(0, 8),
        products: top(ordersList.flatMap((o) => o.items.flatMap((i) => Array.from({ length: i.quantity }, () => i.name))), (n) => n, 6),
        sources: top(visitorsList, (v) => v.source.label, 5),
        devices: top(visitorsList, (v) => (v.device === "mobile" ? "Mobile" : v.device === "desktop" ? "Ordinateur" : null), 2),
        locales: top(visitorsList, (v) => v.locale, 3),
      },
    }))
    .sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);

  const devices = [
    { label: "Mobile", value: visitors.filter((v) => v.device === "mobile").length, color: "var(--rose)" },
    { label: "Ordinateur", value: visitors.filter((v) => v.device === "desktop").length, color: "var(--ink)" },
    { label: "Inconnu", value: visitors.filter((v) => !v.device).length, color: "var(--sand)" },
  ].filter((d) => d.value > 0);
  const locales = [
    { label: "Français", value: visitors.filter((v) => v.locale === "fr").length, color: "var(--ink)" },
    { label: "Anglais", value: visitors.filter((v) => v.locale === "en").length, color: "var(--rose)" },
    { label: "Arabe", value: visitors.filter((v) => v.locale === "ar").length, color: "#a8641e" },
  ].filter((d) => d.value > 0);

  const funnel = [
    { label: "Visiteurs", value: visitors.length },
    { label: "Fiche vue", value: visitors.filter((v) => v.viewed.size > 0).length },
    { label: "Ajout au sac", value: kpis.adders },
    { label: "Paiement", value: withCheckout.length },
    { label: "Commande", value: orders.length },
  ];

  const discountCodes = (() => {
    const m = new Map<string, { code: string; orders: number; revenue: number; discounts: number }>();
    for (const o of orders) for (const code of o.discount_codes) {
      const cur = m.get(code) ?? { code, orders: 0, revenue: 0, discounts: 0 };
      cur.orders++;
      cur.revenue += o.total;
      cur.discounts += o.discounts;
      m.set(code, cur);
    }
    return [...m.values()].sort((a, b) => b.orders - a.orders);
  })();
  const topPages = (() => {
    const m = new Map<string, Set<string>>();
    for (const e of ev) if ((e.name === "page_view" || e.name === "product_view") && e.path) m.set(e.path, (m.get(e.path) ?? new Set()).add(e.anon_id));
    return [...m.entries()].map(([path, s]) => ({ path, visitors: s.size })).sort((a, b) => b.visitors - a.visitors).slice(0, 12);
  })();
  const landingPages = (() => {
    const m = new Map<string, number>();
    for (const v of visitors) if (v.landingPath) m.set(v.landingPath, (m.get(v.landingPath) ?? 0) + 1);
    return [...m.entries()].map(([path, visitors]) => ({ path, visitors })).sort((a, b) => b.visitors - a.visitors).slice(0, 10);
  })();

  const earliest = (rows: { created_at: string }[]) => rows.reduce<string | null>((min, r) => (min === null || r.created_at < min ? r.created_at : min), null);
  const tracked = { since: earliest(events), firstOrder: earliest(allOrders), testOrders: allOrders.filter((o) => o.test).length, unlinkedOrders: orders.filter((o) => !o.anon_id).length, beforeTracking: visitors.filter((v) => v.source.channel === "Inconnue").length };

  return { kpis, carts, currency, facets, perProduct, other, campaigns, sources, channels, countries, devices, locales, series, byDay, funnel, abandonedCarts, allCarts, recentOrders, discountCodes, topPages, landingPages, tracked } as const;
}

export type Business = Awaited<ReturnType<typeof business>>;
export type PerProduct = Business["perProduct"][number];
export type SourceRow = Business["sources"][number];
export type CountryRow = Business["countries"][number];

export async function business(range: Range, f: Filters = {}) {
  const prev = previousRange(range);
  const span = rangeBetween(prev.from, range.to);
  const [eventsAll, ordersAll, catalog] = await Promise.all([loadSite(span), loadOrders(span), loadCatalog()]);
  const within = (iso: string, r: Range) => {
    const t = new Date(iso).getTime();
    return t >= r.from.getTime() && t <= r.to.getTime();
  };
  const current = summarize({ events: eventsAll.filter((e) => within(e.created_at, range)), orders: ordersAll.filter((o) => within(o.created_at, range)), catalog, range, filters: f });
  const previous = core({ events: eventsAll.filter((e) => within(e.created_at, prev)), orders: ordersAll.filter((o) => within(o.created_at, prev)), catalog, range: prev, filters: f });
  return { range, previousRange: prev, filters: f, catalog, ...current, previous: { kpis: previous.kpis, carts: previous.carts } };
}

/* ------------------------------------------------------------------ le parcours sur le site */
const GUIDE_GROUPS: Record<string, string> = { when: "Pour quand ?", universe: "Plutôt…", materials: "Une matière…", material: "Une matière…" };
const GUIDE_VALUES: Record<string, string> = { day: "Jour", evening: "Soir", both: "Les deux" };
const LISTEN_SOURCE: Record<string, string> = { page: "Sur la fiche", menu: "Dans le menu", cart: "Dans le panier", guide: "Dans le guide" };
const pretty = (s: string) => s.replace(/[-_]+/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase());
/** Le nom d'une page d'après son chemin, toutes langues confondues : « Accueil », « Guide des six », le nom du produit… */
export function pageName(path: string | null, products: Product[]): string {
  if (!path) return "–";
  const segs = path.split("?")[0].split("/").filter(Boolean);
  if (segs.length && /^(fr|en|ar)$/.test(segs[0])) segs.shift();
  if (!segs.length) return "Accueil";
  if (segs[0] === "parfums") {
    if (segs.length === 1) return "Les parfums";
    if (segs[1] === "guide") return "Guide des six";
    return products.find((p) => p.handle === segs[1])?.name ?? pretty(segs[1]);
  }
  if (segs[0] === "coffrets") return segs[1] ? products.find((p) => p.handle === segs[1])?.name ?? pretty(segs[1]) : "Les coffrets";
  if (segs[0] === "maison") return "La Maison";
  if (segs[0] === "panier") return "Panier";
  return pretty(segs.join(" / "));
}
async function countLumaSessions(range: Range): Promise<number> {
  try {
    const { count } = await adminDb().from("luma_sessions").select("id", { count: "exact", head: true }).gte("created_at", range.from.toISOString()).lte("created_at", range.to.toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}
const MAX_VISIT_MS = 60 * 60 * 1000;

export type Journey = Awaited<ReturnType<typeof journey>>;
/** Ce que les visiteurs font sur le site : pages, chemins, guide, menu, écoutes, accords — avec la période d'avant pour comparer. */
export async function journey(range: Range, f: Filters = {}) {
  const prev = previousRange(range);
  const span = rangeBetween(prev.from, range.to);
  const [eventsAll, ordersAll, catalog, lumaSessions] = await Promise.all([loadSite(span), loadOrders(span), loadCatalog(), countLumaSessions(range)]);
  const within = (iso: string, r: Range) => {
    const t = new Date(iso).getTime();
    return t >= r.from.getTime() && t <= r.to.getTime();
  };
  const ctx: Ctx = { events: eventsAll.filter((e) => within(e.created_at, range)), orders: ordersAll.filter((o) => within(o.created_at, range)), catalog, range, filters: f };
  const prevCtx: Ctx = { events: eventsAll.filter((e) => within(e.created_at, prev)), orders: ordersAll.filter((o) => within(o.created_at, prev)), catalog, range: prev, filters: f };
  const cur = summarize(ctx);
  const c = core(ctx);
  const p = core(prevCtx);
  const products = catalog.products;
  const name = (path: string | null) => pageName(path, products);

  const measure = (k: ReturnType<typeof core>) => {
    const withPages = k.visitors.filter((v) => v.pageViews > 0);
    const durations = k.visitors.map((v) => Math.min(MAX_VISIT_MS, new Date(v.lastSeen).getTime() - new Date(v.firstSeen).getTime())).filter((d) => d > 0);
    const landings = new Map<string, number>();
    for (const e of k.ev) if (e.name === "page_view" && e.props.landing === true) landings.set(e.anon_id, (landings.get(e.anon_id) ?? 0) + 1);
    const plays = k.ev.filter((e) => e.name === "audio_play");
    return {
      visitors: k.visitors.length,
      pagesPerVisit: withPages.length ? withPages.reduce((n, v) => n + v.pageViews, 0) / withPages.length : null,
      avgDurationMs: durations.length ? durations.reduce((n, d) => n + d, 0) / durations.length : null,
      bounceRate: withPages.length ? withPages.filter((v) => v.pageViews <= 1).length / withPages.length : null,
      returning: [...landings.values()].filter((n) => n >= 2).length,
      plays: plays.length,
      listeners: new Set(plays.map((e) => e.anon_id)).size,
      completes: k.ev.filter((e) => e.name === "audio_complete").length,
      adders: k.kpis.adders,
      checkouts: k.kpis.checkouts,
      orders: k.kpis.orders,
      viewers: k.visitors.filter((v) => v.viewed.size > 0).length,
    };
  };
  const now = measure(c);
  const before = measure(p);
  const ev = c.ev;
  const visitors = c.visitors;

  // Les pages : les plus vues, d'arrivée, de sortie ; les chemins les plus suivis.
  const uniqBy = (rows: { key: string; anon: string }[]) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) m.set(r.key, (m.get(r.key) ?? new Set()).add(r.anon));
    return [...m.entries()].map(([label, s]) => ({ label, count: s.size })).sort((a, b) => b.count - a.count);
  };
  const countOf = (keys: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };
  const pageViews = ev.filter((e) => e.name === "page_view" && e.path);
  const topPages = uniqBy(pageViews.map((e) => ({ key: name(e.path), anon: e.anon_id }))).slice(0, 10);
  const landingPages = countOf(visitors.map((v) => (v.landingPath ? name(v.landingPath) : null))).slice(0, 8);
  const lastPath = new Map<string, string>();
  for (const e of pageViews) lastPath.set(e.anon_id, e.path!); // ev est trié par id croissant : le dernier gagne
  const exitPages = countOf([...lastPath.values()].map((pth) => name(pth))).slice(0, 8);
  const pathsByAnon = new Map<string, string[]>();
  for (const e of pageViews) {
    const list = pathsByAnon.get(e.anon_id) ?? [];
    const n = name(e.path);
    if (list[list.length - 1] !== n) list.push(n);
    pathsByAnon.set(e.anon_id, list);
  }
  const sequences = countOf([...pathsByAnon.values()].filter((l) => l.length >= 2).map((l) => l.slice(0, 3).join(" → ")))
    .slice(0, 8)
    .map((s) => ({ steps: s.label.split(" → "), count: s.count }));
  const depth = countOf([...pathsByAnon.values()].map((l) => (l.length >= 5 ? "5 pages et plus" : `${l.length} page${l.length > 1 ? "s" : ""}`))).sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));

  // Le guide, la carte, le menu.
  const guideFilters = countOf(ev.filter((e) => e.name === "guide_filter" && e.props.on !== false).map((e) => `${GUIDE_GROUPS[str(e.props.group) ?? ""] ?? pretty(str(e.props.group) ?? "?")} · ${GUIDE_VALUES[str(e.props.value) ?? ""] ?? pretty(str(e.props.value) ?? "?")}`)).slice(0, 10);
  const productRows = (evName: string, key: (e: SiteEventRow) => string | null) =>
    products
      .filter((pr) => pr.kind === "reflet")
      .map((pr) => ({ handle: pr.handle, name: pr.name, image: pr.image, count: ev.filter((e) => e.name === evName && key(e) === pr.handle).length }))
      .sort((a, b) => b.count - a.count);
  const mapSelects = productRows("map_select", (e) => str(e.props.handle));
  const mapPairs = ev.filter((e) => e.name === "map_pair" && e.props.on !== false).length;
  const menu = productRows("menu_reflet", (e) => str(e.props.handle));
  const guideVisitors = new Set(pageViews.filter((e) => name(e.path) === "Guide des six").map((e) => e.anon_id)).size;

  // Les écoutes.
  const plays = ev.filter((e) => e.name === "audio_play");
  const completes = ev.filter((e) => e.name === "audio_complete");
  const listens = {
    total: plays.length,
    completes: completes.length,
    listeners: now.listeners,
    byKind: [
      { label: "Portraits", value: plays.filter((e) => str(e.props.kind) !== "accord").length, color: "var(--ink)" },
      { label: "Accords du parfumeur", value: plays.filter((e) => str(e.props.kind) === "accord").length, color: "var(--rose)" },
    ],
    bySource: countOf(plays.map((e) => LISTEN_SOURCE[str(e.props.source) ?? "page"] ?? pretty(str(e.props.source) ?? "page"))),
    perReflet: products
      .filter((pr) => pr.kind === "reflet")
      .map((pr) => ({ handle: pr.handle, name: pr.name, image: pr.image, plays: plays.filter((e) => str(e.props.kind) !== "accord" && str(e.props.id) === pr.handle).length, completes: completes.filter((e) => str(e.props.kind) !== "accord" && str(e.props.id) === pr.handle).length }))
      .sort((a, b) => b.plays - a.plays),
  };
  const accords = LAYERING.map((d) => ({
    id: d.id,
    name: d.name.fr,
    pair: d.pair.map((h) => products.find((pr) => pr.handle === h) ?? { handle: h, name: h, image: null }),
    plays: plays.filter((e) => str(e.props.kind) === "accord" && str(e.props.id) === d.id).length,
    completes: completes.filter((e) => str(e.props.kind) === "accord" && str(e.props.id) === d.id).length,
    addsBoth: ev.filter((e) => e.name === "layering_add" && str(e.props.duo) === d.id).length,
    cartAdds: ev.filter((e) => e.name === "accord_add" && str(e.props.duo) === d.id).length,
    mapPairs: ev.filter((e) => e.name === "map_pair" && d.pair.includes(str(e.props.handle) ?? "")).length,
  }));

  // Par jour.
  const uniqueByDay = (rows: SiteEventRow[]) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) m.set(dayKey(r.created_at), (m.get(dayKey(r.created_at)) ?? new Set()).add(r.anon_id));
    return daysOf(range).map((d) => ({ key: d.key, label: d.label, value: m.get(d.key)?.size ?? 0 }));
  };
  const series = { visitors: uniqueByDay(ev), plays: dailySeries(plays, range) };
  const byDay = daysOf(range).map((d, i) => {
    const day = ev.filter((e) => dayKey(e.created_at) === d.key);
    return {
      key: d.key,
      label: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d.date),
      visitors: series.visitors[i].value,
      pageViews: day.filter((e) => e.name === "page_view").length,
      productViews: day.filter((e) => e.name === "product_view").length,
      plays: day.filter((e) => e.name === "audio_play").length,
      guide: day.filter((e) => e.name === "guide_filter" || e.name === "map_select" || e.name === "map_pair").length,
      adds: day.filter((e) => e.name === "add_to_cart").length,
    };
  });
  const funnel = [
    { label: "Visiteurs", value: now.visitors },
    { label: "Fiche vue", value: now.viewers },
    { label: "Écoute", value: now.listeners },
    { label: "Ajout au sac", value: now.adders },
    { label: "Paiement", value: now.checkouts },
    { label: "Commande", value: now.orders },
  ];

  return { range, previousRange: prev, filters: f, catalog, currency: cur.currency, facets: cur.facets, perProduct: cur.perProduct, tracked: cur.tracked, kpis: now, previous: before, lumaSessions, funnel, series, byDay, topPages, landingPages, exitPages, sequences, depth, guideFilters, guideVisitors, mapSelects, mapPairs, menu, listens, accords };
}

/* ------------------------------------------------------------------ en direct */
export type LivePayload = Awaited<ReturnType<typeof live>>;
const LIVE_WINDOW_MS = 10 * 60 * 1000;
const EVENT_LABEL: Record<string, string> = {
  page_view: "regarde",
  product_view: "ouvre la fiche",
  audio_play: "écoute",
  audio_complete: "a écouté jusqu'au bout",
  guide_filter: "filtre le guide",
  map_select: "ouvre sur la carte",
  map_pair: "cherche l'accord",
  menu_reflet: "parcourt le menu",
  layering_add: "ajoute un accord",
  accord_add: "ajoute l'accord du panier",
  add_to_cart: "ajoute au sac",
  checkout: "part payer",
};

/** Ce qui se passe maintenant : les visiteurs des dix dernières minutes par pays, le fil des gestes, la journée. */
export async function live() {
  const now = Date.now();
  const since = new Date(now - LIVE_WINDOW_MS).toISOString();
  const dayStart = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) + "T00:00:00+04:00").toISOString();
  const [recent, today, ordersToday, catalog] = await Promise.all([
    fetchAll<SiteEventRow>("site_events", (q) => q.gte("created_at", since).order("id", { ascending: false })).catch(() => [] as SiteEventRow[]),
    fetchAll<SiteEventRow>("site_events", (q) => q.gte("created_at", dayStart).order("id", { ascending: true })).catch(() => [] as SiteEventRow[]),
    fetchAll<OrderRow>("shop_orders", (q) => q.gte("created_at", dayStart).eq("test", false).order("created_at", { ascending: false })).catch(() => [] as OrderRow[]),
    loadCatalog(),
  ]);
  const productOf = (h: string | null) => catalog.products.find((p) => p.handle === h) ?? null;
  const nameOf = (h: string | null) => productOf(h)?.name ?? h ?? "";
  const duoName = (id: string | null) => LAYERING.find((d) => d.id === id)?.name.fr ?? id ?? "";
  const byCountry = new Map<string, { code: string; name: string; visitors: Set<string>; lat: number; lng: number; paths: Map<string, number>; lastAt: string }>();
  for (const e of recent) {
    const code = e.country ?? "??";
    const centroid = COUNTRY_CENTROIDS[code];
    const cur = byCountry.get(code) ?? { code, name: code === "??" ? "Pays inconnu" : countryName(code), visitors: new Set<string>(), lat: centroid?.[0] ?? NaN, lng: centroid?.[1] ?? NaN, paths: new Map(), lastAt: e.created_at };
    cur.visitors.add(e.anon_id);
    if (e.path) cur.paths.set(e.path, (cur.paths.get(e.path) ?? 0) + 1);
    if (e.created_at > cur.lastAt) cur.lastAt = e.created_at;
    byCountry.set(code, cur);
  }
  const countries = [...byCountry.values()]
    .map((c) => ({ code: c.code, name: c.name, visitors: c.visitors.size, lat: c.lat, lng: c.lng, onMap: Number.isFinite(c.lat), topPath: [...c.paths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, lastAt: c.lastAt }))
    .sort((a, b) => b.visitors - a.visitors);
  const feed = recent.slice(0, 40).map((e) => {
    const handle = str(e.props.handle) ?? str(e.props.id);
    const handles = Array.isArray(e.props.handles) ? (e.props.handles as string[]) : handle ? [handle] : [];
    const what = e.name === "add_to_cart" || e.name === "checkout" ? handles.map(nameOf).join(" + ") : e.name === "layering_add" || e.name === "accord_add" ? duoName(str(e.props.duo)) : e.name === "guide_filter" ? `${str(e.props.group) ?? ""} · ${str(e.props.value) ?? ""}` : handle ? nameOf(handle) : e.path ?? "";
    const image = thumb(handles.map((h) => productOf(h)?.image ?? null).find(Boolean) ?? null, 96);
    const amount = num(e.props.total);
    return { at: e.created_at, country: e.country, verb: EVENT_LABEL[e.name] ?? e.name, what, image, amount, currency: str(e.props.currency), anon: e.anon_id.slice(0, 6), locale: e.locale, kind: e.name };
  });
  const revenueToday = ordersToday.reduce((n, o) => n + Number(o.total), 0);
  const visitorsNow = new Set(recent.map((e) => e.anon_id)).size;
  const visitorsToday = new Set(today.map((e) => e.anon_id)).size;
  const checkoutsToday = new Set(today.filter((e) => e.name === "checkout").map((e) => e.anon_id)).size;
  const carts = new Set(today.filter((e) => e.name === "add_to_cart").map((e) => e.anon_id)).size;
  const pulse: number[] = [];
  for (let i = 23; i >= 0; i--) {
    const a = now - (i + 1) * 5 * 60 * 1000;
    const b = now - i * 5 * 60 * 1000;
    pulse.push(new Set(today.filter((e) => { const t = new Date(e.created_at).getTime(); return t >= a && t < b; }).map((e) => e.anon_id)).size);
  }
  return {
    at: new Date(now).toISOString(),
    windowMinutes: LIVE_WINDOW_MS / 60000,
    visitorsNow,
    countries,
    feed,
    today: { visitors: visitorsToday, carts, checkouts: checkoutsToday, orders: ordersToday.length, revenue: revenueToday, currency: ordersToday[0]?.currency ?? "AED", lastOrderAt: ordersToday[0]?.created_at ?? null, lastOrderItems: ordersToday[0]?.lines.filter((l) => l.total > 0).map((l) => nameOf(l.handle) || l.title) ?? [] },
    pulse,
  };
}

// Gardé pour les pages Luma (les six Reflets seulement).
export { refletNames };
