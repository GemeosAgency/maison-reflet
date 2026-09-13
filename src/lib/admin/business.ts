/**
 * Le business vu depuis le site : les commandes (shop_orders, posées par le
 * webhook Shopify) croisées avec les parcours anonymes (site_events). Tout se
 * calcule en mémoire à partir de deux jeux de lignes : les VISITEURS (un profil
 * par identifiant anonyme : source d'arrivée, pays, appareil, ce qu'il a vu,
 * son dernier départ en paiement) et les COMMANDES. Les filtres (Reflet, pays,
 * source, langue) s'appliquent aux deux, et chaque chiffre en découle.
 */
import { adminDb } from "./db";
import { COUNTRY_CENTROIDS, countryName } from "./geo";
import { dailySeries, dayKey, fetchAll, loadSite, refletNames, sinceFor, type Days, type SiteEventRow } from "./data";

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
  addedTotal: number | null;
  addedLines: CartLine[];
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
export const fmtMoneyShort = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(".", ",")} k` : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)));

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
export async function loadOrders(days: number): Promise<OrderRow[]> {
  const since = sinceFor(days).toISOString();
  try {
    const rows = await fetchAll<OrderRow>("shop_orders", (q) => q.gte("created_at", since).order("created_at", { ascending: false }));
    return rows.map((r) => ({ ...r, total: Number(r.total), subtotal: Number(r.subtotal), discounts: Number(r.discounts), shipping: Number(r.shipping), lines: Array.isArray(r.lines) ? r.lines : [] }));
  } catch (error) {
    console.error("[admin/business] shop_orders", error);
    return [];
  }
}

/** Les profils de visiteurs, à partir des événements bruts. */
export function buildVisitors(events: SiteEventRow[], orders: OrderRow[]): Map<string, Visitor> {
  const byAnon = new Map<string, Visitor>();
  for (const e of events) {
    let v = byAnon.get(e.anon_id);
    if (!v) {
      v = { anon: e.anon_id, country: null, locale: null, device: null, source: { label: "Avant le suivi", channel: "Inconnue" }, landingPath: null, firstSeen: e.created_at, lastSeen: e.created_at, pageViews: 0, viewed: new Set(), addedTotal: null, addedLines: [], checkout: null, orders: [] };
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
        const t = num(e.props.total);
        if (t !== null) v.addedTotal = t;
        const lines = cartLines(e.props.lines);
        if (lines.length) v.addedLines = lines;
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

/* ------------------------------------------------------------------ le business */
const ONE_HOUR = 3600 * 1000;
export type CartStatus = "paid" | "open" | "abandoned";
export function cartStatus(v: Visitor, now = Date.now()): CartStatus | null {
  if (!v.checkout) return null;
  const at = new Date(v.checkout.at).getTime();
  if (v.orders.some((o) => new Date(o.created_at).getTime() >= at - 10 * 60 * 1000)) return "paid";
  return now - at < ONE_HOUR ? "open" : "abandoned";
}

export type Business = Awaited<ReturnType<typeof business>>;

export async function business(days: Days, f: Filters = {}) {
  const [events, allOrders, names] = await Promise.all([loadSite(days), loadOrders(days), refletNames()]);
  const handleOf = (line: OrderLine) => line.handle ?? (names.find((n) => n.name === line.title)?.handle ?? null);
  const realOrders = allOrders.filter((o) => !o.test);
  const visitorsAll = buildVisitors(events, realOrders);
  // La source d'une commande : celle de son parcours quand on l'a (et qu'elle est connue), sinon ce que Shopify en dit.
  const sourceOf = (o: OrderRow): Source => {
    const v = o.anon_id ? visitorsAll.get(o.anon_id) : undefined;
    return v && v.source.channel !== "Inconnue" ? v.source : orderSource(o);
  };

  // Les facettes des filtres, avant filtrage (pour proposer ce qui existe).
  const facets = {
    countries: [...new Set([...[...visitorsAll.values()].map((v) => v.country), ...realOrders.map((o) => o.country)])].filter((c): c is string => Boolean(c)).sort(),
    sources: [...new Set([...[...visitorsAll.values()].map((v) => v.source.label), ...realOrders.map((o) => sourceOf(o).label)])].sort(),
    reflets: names,
  };

  // Filtrage : un visiteur passe s'il correspond ; une commande passe si elle correspond (par son parcours quand il existe).
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
  const discounts = orders.reduce((n, o) => n + o.discounts, 0);
  const shipping = orders.reduce((n, o) => n + o.shipping, 0);

  // Les paniers : validés (commandes), abandonnés (départ en paiement sans commande après une heure), en cours.
  const withCheckout = visitors.filter((v) => v.checkout);
  const now = Date.now();
  const abandoned = withCheckout.filter((v) => cartStatus(v, now) === "abandoned");
  const open = withCheckout.filter((v) => cartStatus(v, now) === "open");
  const abandonedTotal = abandoned.reduce((n, v) => n + (v.checkout?.total ?? 0), 0);
  const openTotal = open.reduce((n, v) => n + (v.checkout?.total ?? 0), 0);
  const carts = {
    paid: { count: orders.length, total: revenue },
    abandoned: { count: abandoned.length, total: abandonedTotal },
    open: { count: open.length, total: openTotal },
    all: { count: orders.length + abandoned.length + open.length, total: revenue + abandonedTotal + openTotal },
    recoveryRate: withCheckout.length ? orders.filter((o) => o.anon_id && visitorAnon.has(o.anon_id)).length / withCheckout.length : null,
  };

  // Par Reflet.
  const perReflet = names.map(({ handle, name }) => {
    const lines = orders.flatMap((o) => o.lines.filter((l) => handleOf(l) === handle && l.total > 0).map((l) => ({ ...l, order: o })));
    const orderIds = new Set(lines.map((l) => l.order.id));
    const abandonedLines = abandoned.flatMap((v) => v.checkout!.lines.filter((l) => l.handle === handle));
    const viewers = new Set(ev.filter((e) => e.name === "product_view" && str(e.props.handle) === handle).map((e) => e.anon_id)).size;
    const adds = ev.filter((e) => e.name === "add_to_cart" && Array.isArray(e.props.handles) && (e.props.handles as unknown[]).includes(handle)).length;
    return {
      handle,
      name,
      revenue: lines.reduce((n, l) => n + l.total, 0),
      units: lines.reduce((n, l) => n + l.quantity, 0),
      orders: orderIds.size,
      abandoned: abandonedLines.length,
      abandonedTotal: abandonedLines.reduce((n, l) => n + l.amount, 0),
      views: viewers,
      adds,
    };
  });
  perReflet.sort((a, b) => b.revenue - a.revenue || b.views - a.views);
  // Ce qui n'est pas un Reflet (coffret, échantillon payant…) dans les commandes.
  const otherLines = orders.flatMap((o) => o.lines.filter((l) => l.total > 0 && !names.some((n) => n.handle === handleOf(l))));
  const other = { revenue: otherLines.reduce((n, l) => n + l.total, 0), units: otherLines.reduce((n, l) => n + l.quantity, 0), titles: [...new Set(otherLines.map((l) => l.title))] };

  // Les sources : visiteurs, commandes et CA par source d'arrivée.
  const sourceMap = new Map<string, { label: string; channel: Channel; visitors: number; orders: number; revenue: number; checkouts: number }>();
  const bump = (s: Source) => {
    const cur = sourceMap.get(s.label) ?? { label: s.label, channel: s.channel, visitors: 0, orders: 0, revenue: 0, checkouts: 0 };
    sourceMap.set(s.label, cur);
    return cur;
  };
  for (const v of visitors) {
    const cur = bump(v.source);
    cur.visitors++;
    if (v.checkout) cur.checkouts++;
  }
  for (const o of orders) {
    const cur = bump(sourceOf(o));
    cur.orders++;
    cur.revenue += o.total;
  }
  const sources = [...sourceMap.values()].sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  const channels = (["Direct", "Social", "Payant", "Recherche", "Email", "Référent", "Inconnue"] as Channel[])
    .map((channel) => ({ channel, color: CHANNEL_COLORS[channel], visitors: sources.filter((s) => s.channel === channel).reduce((n, s) => n + s.visitors, 0), orders: sources.filter((s) => s.channel === channel).reduce((n, s) => n + s.orders, 0), revenue: sources.filter((s) => s.channel === channel).reduce((n, s) => n + s.revenue, 0) }))
    .filter((c) => c.visitors > 0 || c.orders > 0);
  const campaigns = (() => {
    const m = new Map<string, { campaign: string; source: string; visitors: number; orders: number; revenue: number }>();
    for (const e of ev) {
      if (e.name !== "page_view" || e.props.landing !== true) continue;
      const utm = e.props.utm && typeof e.props.utm === "object" ? (e.props.utm as Record<string, string>) : null;
      if (!utm?.campaign) continue;
      const key = `${utm.source ?? "?"}|${utm.campaign}`;
      const cur = m.get(key) ?? { campaign: utm.campaign, source: utm.source ?? "?", visitors: 0, orders: 0, revenue: 0 };
      cur.visitors++;
      const v = visitorsAll.get(e.anon_id);
      for (const o of v?.orders ?? []) if (keepOrder(o)) {
        cur.orders++;
        cur.revenue += o.total;
      }
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  })();

  // Pays, appareils, langues.
  const countryMap = new Map<string, { code: string; name: string; visitors: number; orders: number; revenue: number }>();
  for (const v of visitors) if (v.country) {
    const cur = countryMap.get(v.country) ?? { code: v.country, name: countryName(v.country), visitors: 0, orders: 0, revenue: 0 };
    cur.visitors++;
    countryMap.set(v.country, cur);
  }
  for (const o of orders) {
    const code = o.country ?? (o.anon_id ? visitorsAll.get(o.anon_id)?.country : null) ?? null;
    if (!code) continue;
    const cur = countryMap.get(code) ?? { code, name: countryName(code), visitors: 0, orders: 0, revenue: 0 };
    cur.orders++;
    cur.revenue += o.total;
    countryMap.set(code, cur);
  }
  const countries = [...countryMap.values()].sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  const devices = [
    { label: "Mobile", value: visitors.filter((v) => v.device === "mobile").length, color: "var(--rose)" },
    { label: "Ordinateur", value: visitors.filter((v) => v.device === "desktop").length, color: "var(--ink)" },
  ];
  const locales = [
    { label: "Français", value: visitors.filter((v) => v.locale === "fr").length, color: "var(--ink)" },
    { label: "Anglais", value: visitors.filter((v) => v.locale === "en").length, color: "var(--rose)" },
    { label: "Arabe", value: visitors.filter((v) => v.locale === "ar").length, color: "#a8641e" },
  ];

  // Les séries par jour.
  const sumByDay = (rows: { created_at: string; amount: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(dayKey(r.created_at), (m.get(dayKey(r.created_at)) ?? 0) + r.amount);
    return dailySeries([], days).map((d) => ({ ...d, value: Math.round(m.get(d.key) ?? 0) }));
  };
  const uniqueByDay = (rows: { created_at: string; anon_id: string }[]) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) m.set(dayKey(r.created_at), (m.get(dayKey(r.created_at)) ?? new Set()).add(r.anon_id));
    return dailySeries([], days).map((d) => ({ ...d, value: m.get(d.key)?.size ?? 0 }));
  };
  const series = {
    revenue: sumByDay(orders.map((o) => ({ created_at: o.created_at, amount: o.total }))),
    orders: dailySeries(orders, days),
    visitors: uniqueByDay(ev),
    checkouts: dailySeries(ev.filter((e) => e.name === "checkout"), days),
    abandoned: sumByDay(abandoned.map((v) => ({ created_at: v.checkout!.at, amount: v.checkout!.total }))),
  };

  // Le parcours global : visiteurs → fiche vue → ajout → paiement → commande.
  const funnel = {
    visitors: visitors.length,
    viewers: visitors.filter((v) => v.viewed.size > 0).length,
    adders: new Set(ev.filter((e) => e.name === "add_to_cart").map((e) => e.anon_id)).size,
    checkouts: withCheckout.length,
    orders: orders.length,
  };

  // Les paniers abandonnés, un par un (les plus récents d'abord), et les commandes récentes.
  const abandonedCarts = [...abandoned, ...open]
    .map((v) => ({ anon: v.anon, at: v.checkout!.at, total: v.checkout!.total, currency: v.checkout!.currency ?? currency, lines: v.checkout!.lines, country: v.country, source: v.source.label, device: v.device, status: cartStatus(v, now) as CartStatus }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const recentOrders = orders.slice(0, 50).map((o) => ({ ...o, source: sourceOf(o), items: o.lines.filter((l) => l.total > 0).map((l) => `${l.quantity > 1 ? `${l.quantity} × ` : ""}${names.find((n) => n.handle === handleOf(l))?.name ?? l.title}`), linked: Boolean(o.anon_id && visitorsAll.has(o.anon_id)) }));
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
  const tracked = { since: earliest(events), firstOrder: earliest(allOrders), testOrders: allOrders.filter((o) => o.test).length, unlinkedOrders: orders.filter((o) => !o.anon_id).length };

  return {
    days,
    filters: f,
    facets,
    currency,
    kpis: {
      revenue,
      orders: orders.length,
      aov: orders.length ? revenue / orders.length : null,
      units,
      discounts,
      shipping,
      visitors: visitors.length,
      conversion: visitors.length ? orders.length / visitors.length : null,
      checkoutRate: visitors.length ? withCheckout.length / visitors.length : null,
    },
    carts,
    perReflet,
    other,
    sources,
    channels,
    campaigns,
    countries,
    devices,
    locales,
    series,
    funnel,
    abandonedCarts,
    recentOrders,
    discountCodes,
    topPages,
    landingPages,
    tracked,
    names,
  };
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
  add_to_cart: "ajoute au panier",
  checkout: "part payer",
};

/** Ce qui se passe maintenant : les visiteurs des dix dernières minutes par pays, le fil des gestes, la journée. */
export async function live() {
  const now = Date.now();
  const since = new Date(now - LIVE_WINDOW_MS).toISOString();
  const dayStart = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) + "T00:00:00+04:00").toISOString();
  const [recent, today, ordersToday, names] = await Promise.all([
    fetchAll<SiteEventRow>("site_events", (q) => q.gte("created_at", since).order("id", { ascending: false })).catch(() => [] as SiteEventRow[]),
    fetchAll<SiteEventRow>("site_events", (q) => q.gte("created_at", dayStart).order("id", { ascending: true })).catch(() => [] as SiteEventRow[]),
    fetchAll<OrderRow>("shop_orders", (q) => q.gte("created_at", dayStart).eq("test", false).order("created_at", { ascending: false })).catch(() => [] as OrderRow[]),
    refletNames(),
  ]);
  const nameOf = (h: string | null) => names.find((n) => n.handle === h)?.name ?? h ?? "";
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
    const what = e.name === "add_to_cart" || e.name === "checkout" ? (Array.isArray(e.props.handles) ? (e.props.handles as string[]).map(nameOf).join(" + ") : "") : e.name === "layering_add" || e.name === "accord_add" ? str(e.props.duo) ?? "" : e.name === "guide_filter" ? `${str(e.props.group) ?? ""} · ${str(e.props.value) ?? ""}` : handle ? nameOf(handle) : e.path ?? "";
    const amount = num(e.props.total);
    return { at: e.created_at, country: e.country, verb: EVENT_LABEL[e.name] ?? e.name, what, amount, currency: str(e.props.currency), anon: e.anon_id.slice(0, 6), locale: e.locale, kind: e.name };
  });
  const revenueToday = ordersToday.reduce((n, o) => n + Number(o.total), 0);
  const visitorsNow = new Set(recent.map((e) => e.anon_id)).size;
  const visitorsToday = new Set(today.map((e) => e.anon_id)).size;
  const checkoutsToday = new Set(today.filter((e) => e.name === "checkout").map((e) => e.anon_id)).size;
  const carts = new Set(today.filter((e) => e.name === "add_to_cart").map((e) => e.anon_id)).size;
  // Le pouls : visiteurs distincts par tranche de 5 minutes sur les deux dernières heures.
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
