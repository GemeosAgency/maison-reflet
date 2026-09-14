/**
 * Les données de la tour de contrôle : lecture des tables Luma (sessions,
 * messages, signaux, événements) et des événements du site, agrégées en
 * mémoire — à l'échelle d'un lancement, quelques milliers de lignes par
 * période, c'est instantané et ça évite des vues SQL à maintenir.
 * Tout est en heure de Dubaï, comme l'équipe.
 */
import { adminDb } from "./db";
import { LAYERING } from "../layering";
import { getAllProducts, isCoffret } from "../shopify";

export type Days = 7 | 30 | 90;
export const RANGES: Days[] = [7, 30, 90];
export const TZ = "Asia/Dubai";
const DAY_MS = 86400000;

/**
 * La période regardée : un préréglage (7, 30, 90 derniers jours) ou deux dates
 * sur mesure (`?from=AAAA-MM-JJ&to=AAAA-MM-JJ`), bornées aux journées de Dubaï.
 * `query` remet la période dans une URL, `label` la dit en français.
 */
export type Range = { from: Date; to: Date; days: number; preset: Days | null; query: string; label: string; fromKey: string; toKey: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dubaiMidnight = (key: string) => new Date(`${key}T00:00:00+04:00`);
const fmtRangeDay = (d: Date, withYear: boolean) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(d);

export function rangeBetween(from: Date, to: Date, preset: Days | null = null): Range {
  const fromKey = dayKey(from.toISOString());
  const toKey = dayKey(to.toISOString());
  const days = Math.max(1, Math.round((dubaiMidnight(toKey).getTime() - dubaiMidnight(fromKey).getTime()) / DAY_MS) + 1);
  const sameYear = fromKey.slice(0, 4) === toKey.slice(0, 4);
  return {
    from: dubaiMidnight(fromKey),
    to: new Date(dubaiMidnight(toKey).getTime() + DAY_MS - 1),
    days,
    preset,
    query: preset ? `days=${preset}` : `from=${fromKey}&to=${toKey}`,
    label: preset ? `${preset} derniers jours` : fromKey === toKey ? fmtRangeDay(from, true) : `${fmtRangeDay(dubaiMidnight(fromKey), !sameYear)} – ${fmtRangeDay(dubaiMidnight(toKey), true)}`,
    fromKey,
    toKey,
  };
}
export function rangeForDays(days: Days): Range {
  const today = dubaiMidnight(dayKey(new Date().toISOString()));
  return rangeBetween(new Date(today.getTime() - (days - 1) * DAY_MS), today, days);
}
export function parseRange(params: URLSearchParams): Range {
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
    const today = dubaiMidnight(dayKey(new Date().toISOString()));
    let a = dubaiMidnight(from);
    let b = dubaiMidnight(to);
    if (Number.isFinite(a.getTime()) && Number.isFinite(b.getTime())) {
      if (b > today) b = today;
      if (a > b) [a, b] = [b, a];
      if ((b.getTime() - a.getTime()) / DAY_MS > 366) a = new Date(b.getTime() - 366 * DAY_MS);
      return rangeBetween(a, b, null);
    }
  }
  return rangeForDays(parseDays(params.get("days")));
}
/** La période juste avant, de même longueur (pour les comparaisons). */
export function previousRange(r: Range): Range {
  return rangeBetween(new Date(r.from.getTime() - r.days * DAY_MS), new Date(r.from.getTime() - DAY_MS), null);
}

export function parseDays(v: string | null | undefined): Days {
  const n = Number(v);
  return (RANGES as number[]).includes(n) ? (n as Days) : 30;
}
export function sinceFor(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

/* ------------------------------------------------------------------ types */
export type SessionRow = {
  id: string;
  anon_id: string;
  locale: "fr" | "en" | "ar";
  country: string | null;
  currency: string | null;
  initiative: string | null;
  email: string | null;
  klaviyo_id: string | null;
  created_at: string;
  last_seen_at: string;
};
export type MessageRow = {
  id: number;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  violations: unknown[];
  regenerated: boolean;
  created_at: string;
};
export type EventRow = { id: number; session_id: string | null; name: string; props: Record<string, unknown>; created_at: string };
export type SignalRow = {
  session_id: string;
  recommended_handle: string | null;
  alternative_handle: string | null;
  cited_origin: string | null;
  for_whom: string | null;
  occasion: string | null;
  wears_today: string | null;
  updated_at: string;
};
export type SiteEventRow = { id: number; anon_id: string; name: string; props: Record<string, unknown>; path: string | null; locale: string | null; country: string | null; city?: string | null; created_at: string };
export type AuditRow = { id: number; actor: string; action: string; target: string | null; details: Record<string, unknown>; created_at: string };

/* --------------------------------------------------------------- lecture */
const PAGE = 1000;
export async function fetchAll<T>(table: string, build: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 20; page++) {
    const q = build(adminDb().from(table).select("*")).range(page * PAGE, page * PAGE + PAGE - 1);
    const { data, error } = await q;
    if (error) throw new Error(`[admin/data] ${table} : ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export type LumaData = { sessions: SessionRow[]; messages: MessageRow[]; events: EventRow[]; signals: SignalRow[] };

export async function loadLuma(range: Range): Promise<LumaData> {
  const since = range.from.toISOString();
  const until = range.to.toISOString();
  const sessions = await fetchAll<SessionRow>("luma_sessions", (q) => q.gte("created_at", since).lte("created_at", until).order("created_at", { ascending: false }));
  const ids = sessions.map((s) => s.id);
  if (ids.length === 0) return { sessions, messages: [], events: [], signals: [] };
  const [messages, events, signals] = await Promise.all([
    fetchAll<MessageRow>("luma_messages", (q) => q.in("session_id", ids).order("id", { ascending: true })),
    fetchAll<EventRow>("luma_events", (q) => q.gte("created_at", since).lte("created_at", until).order("id", { ascending: true })),
    fetchAll<SignalRow>("luma_profile_signals", (q) => q.in("session_id", ids)),
  ]);
  return { sessions, messages, events, signals };
}

export async function loadSite(range: Range): Promise<SiteEventRow[]> {
  const since = range.from.toISOString();
  const until = range.to.toISOString();
  try {
    return await fetchAll<SiteEventRow>("site_events", (q) => q.gte("created_at", since).lte("created_at", until).order("id", { ascending: true }));
  } catch (error) {
    // La table n'existe pas encore (migration 0003 pas appliquée) : la page « Site » le dit, le reste vit.
    console.error("[admin/data] site_events", error);
    return [];
  }
}

/* ------------------------------------------------------------- utilitaires */
export const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
export const fmtPct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)} %` : "–");
export const fmtMs = (ms: number | null | undefined) => (ms == null || !Number.isFinite(ms) ? "–" : ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${Math.round(ms)} ms`);
export const fmtUsd = (usd: number) => `${usd.toFixed(2).replace(".", ",")} $`;
export const fmtDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const fmtDay = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" }).format(new Date(iso));
export const fmtTime = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const fmtDuration = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")}` : `${s} s`;
};
export const LOCALE_LABEL: Record<string, string> = { fr: "Français", en: "Anglais", ar: "Arabe" };
export const ENTRY_LABEL: Record<string, string> = {
  header: "En-tête",
  product: "Fiche",
  collection: "Les parfums",
  guide: "Guide",
  menu: "Menu",
  cart: "Panier",
  home: "Accueil",
  pill: "Pastille",
};
export const entryLabel = (e: string | null) => (e ? ENTRY_LABEL[e] ?? e : "Non renseignée");
export const PAGE_LABEL: Record<string, string> = { product: "Fiche parfum", coffret: "Coffret", collection: "Les parfums", guide: "Guide", home: "Accueil", maison: "La Maison" };
export const pageLabel = (p: string | null) => (p ? PAGE_LABEL[p] ?? p : "–");
export const localeLabel = (l: string | null) => (l ? LOCALE_LABEL[l] ?? l : "–");

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
/** Les jours de la période, dans l'ordre, avec leur clé (AAAA-MM-JJ, Dubaï) et leur étiquette courte. */
export function daysOf(range: Range): { key: string; label: string; date: Date }[] {
  const out: { key: string; label: string; date: Date }[] = [];
  for (let i = 0; i < range.days; i++) {
    const d = new Date(range.from.getTime() + i * DAY_MS + 12 * 3600 * 1000); // midi, à l'abri des changements d'heure
    out.push({ key: dayKey(d.toISOString()), label: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d), date: d });
  }
  return out;
}
export function dailySeries(rows: { created_at: string }[], range: Range): { key: string; label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(dayKey(r.created_at), (counts.get(dayKey(r.created_at)) ?? 0) + 1);
  return daysOf(range).map((d) => ({ key: d.key, label: d.label, value: counts.get(d.key) ?? 0 }));
}
export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Coût estimé du modèle (Sonnet 5, dollars par million de tokens) : une estimation, pas une facture. */
const PRICE_IN = 3;
const PRICE_OUT = 15;
export function estimateCost(messages: MessageRow[]): number {
  let tin = 0;
  let tout = 0;
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    tin += m.tokens_in ?? 0;
    tout += m.tokens_out ?? 0;
  }
  return (tin / 1e6) * PRICE_IN + (tout / 1e6) * PRICE_OUT;
}

/** Les noms des Reflets, depuis Shopify (repli sur le handle). */
export async function refletNames(): Promise<{ handle: string; name: string }[]> {
  try {
    return (await getAllProducts()).filter((p) => !isCoffret(p)).map((p) => ({ handle: p.handle, name: p.title }));
  } catch {
    return [...new Set(LAYERING.flatMap((d) => d.pair))].map((h) => ({ handle: h, name: h }));
  }
}
export const nameOf = (names: { handle: string; name: string }[], handle: string | null) => names.find((n) => n.handle === handle)?.name ?? handle ?? "–";

/* ------------------------------------------------------------- vue d'ensemble */
export type Overview = {
  days: number;
  conversations: number;
  userTurns: number;
  withCard: number;
  emails: number;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  p50: number | null;
  p95: number | null;
  incidents: { key: string; label: string; count: number; spark: number[] }[];
  seriesConversations: ReturnType<typeof dailySeries>;
  seriesTurns: ReturnType<typeof dailySeries>;
  byLocale: { label: string; count: number }[];
  byCountry: { label: string; count: number }[];
  byEntry: { label: string; count: number }[];
  byPage: { label: string; count: number }[];
  recent: ConversationRow[];
  site: { views: number; plays: number; adds: number; checkouts: number; visitors: number; since: string | null };
};

export type ConversationRow = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  locale: string;
  country: string | null;
  entry: string | null;
  page: string | null;
  turns: number;
  violations: number;
  regenerated: number;
  hasEmail: boolean;
  recommended: string | null;
  firstQuestion: string;
  durationMs: number;
  fallback: boolean;
  handoff: boolean;
  withCard: boolean;
};

function sessionEntry(events: EventRow[]): { entry: string | null; page: string | null; withCard: boolean; fallback: boolean; handoff: boolean } {
  let entry: string | null = null;
  let page: string | null = null;
  let withCard = false;
  let fallback = false;
  let handoff = false;
  for (const e of events) {
    if (e.name === "reply") {
      entry ??= str(e.props.entry);
      page ??= str(e.props.page);
      if (arr(e.props.actions).includes("show_product")) withCard = true;
    } else if (e.name === "fallback") fallback = true;
    else if (e.name === "handoff") handoff = true;
  }
  return { entry, page, withCard, fallback, handoff };
}

export function buildConversations(data: LumaData): ConversationRow[] {
  const bySession = new Map<string, MessageRow[]>();
  for (const m of data.messages) bySession.set(m.session_id, [...(bySession.get(m.session_id) ?? []), m]);
  const evBySession = new Map<string, EventRow[]>();
  for (const e of data.events) if (e.session_id) evBySession.set(e.session_id, [...(evBySession.get(e.session_id) ?? []), e]);
  const sigBySession = new Map(data.signals.map((s) => [s.session_id, s]));
  return data.sessions.map((s) => {
    const msgs = bySession.get(s.id) ?? [];
    const users = msgs.filter((m) => m.role === "user");
    const assistants = msgs.filter((m) => m.role === "assistant");
    const meta = sessionEntry(evBySession.get(s.id) ?? []);
    return {
      id: s.id,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      locale: s.locale,
      country: s.country,
      entry: meta.entry ?? s.initiative,
      page: meta.page,
      turns: users.length,
      violations: assistants.reduce((n, m) => n + (Array.isArray(m.violations) ? m.violations.length : 0), 0),
      regenerated: assistants.filter((m) => m.regenerated).length,
      hasEmail: Boolean(s.email),
      recommended: sigBySession.get(s.id)?.recommended_handle ?? null,
      firstQuestion: (users[0]?.content ?? "").replace(/\s+/g, " ").trim(),
      durationMs: Math.max(0, new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime()),
      fallback: meta.fallback,
      handoff: meta.handoff,
      withCard: meta.withCard,
    };
  });
}

export async function overview(range: Range): Promise<Overview> {
  const [data, site] = await Promise.all([loadLuma(range), loadSite(range)]);
  const rows = buildConversations(data);
  const replies = data.events.filter((e) => e.name === "reply");
  const latencies = replies.map((e) => num(e.props.total_ms)).filter((n): n is number => n !== null);
  const incidentDefs: [string, string][] = [
    ["fallback", "Réponses de secours"],
    ["rate_limited", "Débit limité"],
    ["daily_cap", "Plafond du jour"],
    ["handoff", "Passages à un humain"],
    ["email_capture_proposed", "Emails proposés"],
  ];
  const incidents = incidentDefs.map(([key, label]) => {
    const evs = data.events.filter((e) => e.name === key);
    return { key, label, count: evs.length, spark: dailySeries(evs, range).map((d) => d.value) };
  });
  let tokensIn = 0;
  let tokensOut = 0;
  for (const m of data.messages) if (m.role === "assistant") {
    tokensIn += m.tokens_in ?? 0;
    tokensOut += m.tokens_out ?? 0;
  }
  const users = data.messages.filter((m) => m.role === "user");
  const views = site.filter((e) => e.name === "product_view");
  return {
    days: range.days,
    conversations: rows.length,
    userTurns: users.length,
    withCard: rows.filter((r) => r.withCard).length,
    emails: rows.filter((r) => r.hasEmail).length,
    cost: estimateCost(data.messages),
    tokensIn,
    tokensOut,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    incidents,
    seriesConversations: dailySeries(data.sessions, range),
    seriesTurns: dailySeries(users, range),
    byLocale: countBy(rows, (r) => localeLabel(r.locale)),
    byCountry: countBy(rows, (r) => r.country).slice(0, 8),
    byEntry: countBy(rows, (r) => entryLabel(r.entry)),
    byPage: countBy(rows, (r) => pageLabel(r.page)),
    recent: rows.slice(0, 6),
    site: {
      views: views.length,
      plays: site.filter((e) => e.name === "audio_play").length,
      adds: site.filter((e) => e.name === "add_to_cart").length,
      checkouts: site.filter((e) => e.name === "checkout").length,
      visitors: new Set(site.map((e) => e.anon_id)).size,
      since: site[0]?.created_at ?? null,
    },
  };
}

/* ------------------------------------------------------------- conversations */
export type ConversationFilters = { locale?: string; country?: string; entry?: string; email?: boolean; violations?: boolean; q?: string; page?: number };
export const PER_PAGE = 40;

export async function conversations(range: Range, f: ConversationFilters) {
  const data = await loadLuma(range);
  let rows = buildConversations(data);
  const facets = {
    locales: countBy(rows, (r) => r.locale),
    countries: countBy(rows, (r) => r.country),
    entries: countBy(rows, (r) => r.entry),
  };
  if (f.locale) rows = rows.filter((r) => r.locale === f.locale);
  if (f.country) rows = rows.filter((r) => r.country === f.country);
  if (f.entry) rows = rows.filter((r) => r.entry === f.entry);
  if (f.email) rows = rows.filter((r) => r.hasEmail);
  if (f.violations) rows = rows.filter((r) => r.violations > 0 || r.fallback || r.regenerated > 0);
  if (f.q) {
    const q = f.q.toLowerCase();
    const matching = new Set(data.messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.session_id));
    rows = rows.filter((r) => matching.has(r.id));
  }
  const total = rows.length;
  const page = Math.max(1, f.page ?? 1);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return { rows: rows.slice((page - 1) * PER_PAGE, page * PER_PAGE), total, page: Math.min(page, pages), pages, facets };
}

export async function conversation(id: string) {
  const { data: session, error } = await adminDb().from("luma_sessions").select("*").eq("id", id).maybeSingle();
  if (error || !session) return null;
  const [messages, events, signal] = await Promise.all([
    fetchAll<MessageRow>("luma_messages", (q) => q.eq("session_id", id).order("id", { ascending: true })),
    fetchAll<EventRow>("luma_events", (q) => q.eq("session_id", id).order("id", { ascending: true })),
    adminDb().from("luma_profile_signals").select("*").eq("session_id", id).maybeSingle(),
  ]);
  return { session: session as SessionRow, messages, events, signal: (signal.data ?? null) as SignalRow | null };
}

/* ------------------------------------------------------------- questions */
const THEMES: { key: string; label: string; re: RegExp }[] = [
  { key: "choose", label: "Choisir, pour qui", re: /\b(quel|quelle|lequel|laquelle|which|conseil|recommand|pour (moi|elle|lui|un homme|une femme|ma |mon )|أي|أنسب|تنصح)/i },
  { key: "compare", label: "Différences, comparaisons", re: /(diff[ée]ren|compar|versus|\bvs\b|الفرق|أفضل من)/i },
  { key: "longevity", label: "Tenue, sillage", re: /(tenue|tient|dure|sillage|longévit|long[- ]?last|longevity|projection|يدوم|ثبات|فوحان)/i },
  { key: "notes", label: "Matières, notes", re: /(\bnote|matière|vanill|\boud\b|cuir|safran|saffron|musc|musk|rose|mangue|mango|ingr[ée]dient|composition|leather|رائحة|مكونات|عود|فانيليا)/i },
  { key: "price", label: "Prix, promotions", re: /(prix|combien|cher|price|cost|discount|promo|réduc|code|سعر|خصم|كم)/i },
  { key: "shipping", label: "Livraison, retours", re: /(livraison|livr[ée]|shipping|deliver|retour|refund|rembours|شحن|توصيل|إرجاع|استرجاع)/i },
  { key: "sample", label: "Échantillons, coffrets", re: /([ée]chantillon|sample|coffret|d[ée]couverte|discovery|عينة|علبة|مجموعة)/i },
  { key: "gift", label: "Cadeaux", re: /(cadeau|offrir|gift|هدية)/i },
  { key: "origin", label: "Références, inspirations", re: /(original|inspir|copie|dupe|tuscan|baccarat|bois imp|altha|erba|maracuja|الأصل|نسخة)/i },
  { key: "layering", label: "Accords, layering", re: /(layer|superpos|accord|marier|ensemble|combin|mélang|طبق|مزج)/i },
];
const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[\s?!.…]+$/g, "").trim();
const UNANSWERED = /(je ne (sais|peux) pas|je n'ai pas (l'information|cette information)|pas (d'|l')information|i (don't|do not) (know|have)|i can(not|'t)|لا أستطيع|لا أعرف|ليس لدي)/i;

export async function questions(range: Range) {
  const data = await loadLuma(range);
  const users = data.messages.filter((m) => m.role === "user" && m.content.trim());
  const grouped = new Map<string, { text: string; count: number; sessions: Set<string>; last: string }>();
  for (const m of users) {
    const key = normalise(m.content);
    if (key.length < 3) continue;
    const g = grouped.get(key) ?? { text: m.content.trim(), count: 0, sessions: new Set<string>(), last: m.created_at };
    g.count++;
    g.sessions.add(m.session_id);
    if (m.created_at > g.last) g.last = m.created_at;
    grouped.set(key, g);
  }
  const top = [...grouped.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1)).slice(0, 40).map((g) => ({ text: g.text, count: g.count, sessions: g.sessions.size, last: g.last }));
  const themeCounts = THEMES.map((t) => ({ key: t.key, label: t.label, count: users.filter((m) => t.re.test(m.content)).length }));
  themeCounts.push({ key: "other", label: "Autres", count: users.filter((m) => !THEMES.some((t) => t.re.test(m.content))).length });
  themeCounts.sort((a, b) => b.count - a.count);
  // Sans réponse claire : la réponse de Luma dit qu'elle ne sait pas, a été régénérée, a une infraction, ou la session a eu une réponse de secours.
  const fallbackSessions = new Set(data.events.filter((e) => e.name === "fallback").map((e) => e.session_id));
  const unanswered: { question: string; answer: string; sessionId: string; createdAt: string; reasons: string[] }[] = [];
  const bySession = new Map<string, MessageRow[]>();
  for (const m of data.messages) bySession.set(m.session_id, [...(bySession.get(m.session_id) ?? []), m]);
  for (const [sid, msgs] of bySession) {
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role !== "assistant") continue;
      const reasons: string[] = [];
      if (UNANSWERED.test(m.content)) reasons.push("dit ne pas savoir");
      if (Array.isArray(m.violations) && m.violations.length) reasons.push(`${m.violations.length} infraction${m.violations.length > 1 ? "s" : ""}`);
      if (m.regenerated) reasons.push("régénérée");
      if (!m.content && fallbackSessions.has(sid)) reasons.push("réponse de secours");
      if (!reasons.length) continue;
      const q = [...msgs.slice(0, i)].reverse().find((x) => x.role === "user");
      unanswered.push({ question: q?.content ?? "(sans question)", answer: m.content, sessionId: sid, createdAt: m.created_at, reasons });
    }
  }
  unanswered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { total: users.length, distinct: grouped.size, top, themes: themeCounts, unanswered: unanswered.slice(0, 60) };
}

/* ------------------------------------------------------------- reflets & accords */
export async function reflets(range: Range) {
  const [data, site, names] = await Promise.all([loadLuma(range), loadSite(range), refletNames()]);
  const uniq = (rows: SiteEventRow[]) => new Set(rows.map((e) => e.anon_id)).size;
  const per = names.map(({ handle, name }) => {
    const plays = site.filter((e) => e.name === "audio_play" && str(e.props.kind) === "portrait" && str(e.props.id) === handle);
    const completes = site.filter((e) => e.name === "audio_complete" && str(e.props.kind) === "portrait" && str(e.props.id) === handle);
    return {
      handle,
      name,
      recommended: data.signals.filter((s) => s.recommended_handle === handle).length,
      alternative: data.signals.filter((s) => s.alternative_handle === handle).length,
      views: uniq(site.filter((e) => e.name === "product_view" && str(e.props.handle) === handle)),
      plays: plays.length,
      completes: completes.length,
      adds: site.filter((e) => e.name === "add_to_cart" && arr(e.props.handles).includes(handle)).length,
      mapSelects: site.filter((e) => e.name === "map_select" && str(e.props.handle) === handle).length,
      menu: site.filter((e) => e.name === "menu_reflet" && str(e.props.handle) === handle).length,
    };
  });
  const accords = LAYERING.map((d) => ({
    id: d.id,
    name: d.name.fr,
    pair: d.pair.map((h) => nameOf(names, h)),
    plays: site.filter((e) => e.name === "audio_play" && str(e.props.kind) === "accord" && str(e.props.id) === d.id).length,
    completes: site.filter((e) => e.name === "audio_complete" && str(e.props.kind) === "accord" && str(e.props.id) === d.id).length,
    addsBoth: site.filter((e) => e.name === "layering_add" && str(e.props.duo) === d.id).length,
    cartAdds: site.filter((e) => e.name === "accord_add" && str(e.props.duo) === d.id).length,
    mapPairs: site.filter((e) => e.name === "map_pair" && d.pair.includes(str(e.props.handle) ?? "")).length,
  }));
  const doors = {
    origins: countBy(data.signals, (s) => s.cited_origin),
    wears: countBy(data.signals, (s) => s.wears_today),
    forWhom: countBy(data.signals, (s) => s.for_whom),
    occasion: countBy(data.signals, (s) => s.occasion),
  };
  const recommendedTotal = per.reduce((n, r) => n + r.recommended, 0);
  return { per, accords, doors, recommendedTotal, hasSite: site.length > 0 };
}

/* ------------------------------------------------------------- site */
export async function site(range: Range) {
  const [events, names] = await Promise.all([loadSite(range), refletNames()]);
  const anon = (rows: SiteEventRow[]) => new Set(rows.map((e) => e.anon_id));
  const funnel = names.map(({ handle, name }) => {
    const viewers = anon(events.filter((e) => e.name === "product_view" && str(e.props.handle) === handle));
    const listeners = new Set([...anon(events.filter((e) => e.name === "audio_play" && str(e.props.id) === handle))].filter((a) => viewers.has(a) || true));
    const adders = anon(events.filter((e) => e.name === "add_to_cart" && arr(e.props.handles).includes(handle)));
    const buyers = anon(events.filter((e) => e.name === "checkout" && arr(e.props.handles).includes(handle)));
    return { handle, name, views: viewers.size, plays: listeners.size, adds: adders.size, checkouts: buyers.size };
  });
  const filters = countBy(events.filter((e) => e.name === "guide_filter" && e.props.on !== false), (e) => `${str(e.props.group) ?? "?"} · ${str(e.props.value) ?? "?"}`).slice(0, 12);
  const mapSelects = countBy(events.filter((e) => e.name === "map_select"), (e) => nameOf(names, str(e.props.handle)));
  const mapPairs = events.filter((e) => e.name === "map_pair" && e.props.on !== false).length;
  const menu = countBy(events.filter((e) => e.name === "menu_reflet"), (e) => nameOf(names, str(e.props.handle)));
  const plays = events.filter((e) => e.name === "audio_play");
  const completes = events.filter((e) => e.name === "audio_complete");
  const bySource = countBy(plays, (e) => str(e.props.source) ?? "page");
  const byPath = countBy(events.filter((e) => e.name === "product_view" || e.name === "page_view"), (e) => e.path).slice(0, 10);
  return {
    since: events[0]?.created_at ?? null,
    total: events.length,
    visitors: new Set(events.map((e) => e.anon_id)).size,
    seriesVisitors: dailySeriesUnique(events, range),
    funnel,
    filters,
    mapSelects,
    mapPairs,
    menu,
    audio: { plays: plays.length, completes: completes.length, bySource },
    byLocale: countBy(events, (e) => localeLabel(e.locale)),
    byCountry: countBy(events, (e) => e.country).slice(0, 8),
    byPath,
    names,
  };
}
function dailySeriesUnique(rows: SiteEventRow[], range: Range) {
  const perDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = dayKey(r.created_at);
    perDay.set(k, (perDay.get(k) ?? new Set()).add(r.anon_id));
  }
  return dailySeries([], range).map((d) => ({ ...d, value: perDay.get(d.key)?.size ?? 0 }));
}

/* ------------------------------------------------------------- RGPD */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function rgpdSearch(q: string) {
  const needle = q.trim();
  if (!needle) return { sessions: [] as SessionRow[], anonIds: [] as string[], siteEvents: 0, mode: "none" as const };
  const mode = EMAIL_RE.test(needle) ? ("email" as const) : ("id" as const);
  const query = adminDb().from("luma_sessions").select("*").order("created_at", { ascending: false }).limit(200);
  // Un identifiant : le cookie du visiteur (anon_id) ou, s'il a la forme d'un UUID, l'identifiant de session.
  const { data, error } =
    mode === "email" ? await query.ilike("email", needle) : UUID_RE.test(needle) ? await query.or(`anon_id.eq.${needle},id.eq.${needle}`) : await query.eq("anon_id", needle);
  if (error) throw new Error(`[admin/rgpd] ${error.message}`);
  const sessions = (data ?? []) as SessionRow[];
  const anonIds = [...new Set([...sessions.map((s) => s.anon_id), ...(mode === "id" ? [needle] : [])])];
  let siteEvents = 0;
  try {
    const { count } = await adminDb().from("site_events").select("id", { count: "exact", head: true }).in("anon_id", anonIds.length ? anonIds : ["-"]);
    siteEvents = count ?? 0;
  } catch {
    siteEvents = 0;
  }
  // Les commandes reliées au parcours (shop_orders.anon_id) : aucune donnée personnelle dedans, mais le lien, lui, s'efface.
  let orders = 0;
  try {
    const { count } = await adminDb().from("shop_orders").select("id", { count: "exact", head: true }).in("anon_id", anonIds.length ? anonIds : ["-"]);
    orders = count ?? 0;
  } catch {
    orders = 0;
  }
  return { sessions, anonIds, siteEvents, orders, mode };
}
export async function rgpdExport(q: string) {
  const found = await rgpdSearch(q);
  const ids = found.sessions.map((s) => s.id);
  const [messages, events, signals, siteEvents, orders] = await Promise.all([
    ids.length ? fetchAll<MessageRow>("luma_messages", (x) => x.in("session_id", ids).order("id", { ascending: true })) : [],
    ids.length ? fetchAll<EventRow>("luma_events", (x) => x.in("session_id", ids).order("id", { ascending: true })) : [],
    ids.length ? fetchAll<SignalRow>("luma_profile_signals", (x) => x.in("session_id", ids)) : [],
    found.anonIds.length ? fetchAll<SiteEventRow>("site_events", (x) => x.in("anon_id", found.anonIds).order("id", { ascending: true })).catch(() => []) : [],
    found.anonIds.length ? fetchAll<Record<string, unknown>>("shop_orders", (x) => x.in("anon_id", found.anonIds).order("created_at", { ascending: true })).catch(() => []) : [],
  ]);
  return { exportedAt: new Date().toISOString(), query: q, sessions: found.sessions, messages, events, signals, siteEvents, orders };
}
export async function rgpdDelete(q: string) {
  const found = await rgpdSearch(q);
  const ids = found.sessions.map((s) => s.id);
  let sessions = 0;
  let events = 0;
  if (ids.length) {
    const { error, count } = await adminDb().from("luma_sessions").delete({ count: "exact" }).in("id", ids);
    if (error) throw new Error(`[admin/rgpd] effacement : ${error.message}`);
    sessions = count ?? ids.length;
  }
  if (found.anonIds.length) {
    try {
      const { count } = await adminDb().from("site_events").delete({ count: "exact" }).in("anon_id", found.anonIds);
      events = count ?? 0;
    } catch {
      events = 0;
    }
    // La commande reste (comptabilité, sans donnée personnelle) ; son lien au parcours, non.
    try {
      await adminDb().from("shop_orders").update({ anon_id: null, ga_client: null }).in("anon_id", found.anonIds);
    } catch {
      /* table absente : rien à délier */
    }
  }
  return { sessions, events };
}

/* ------------------------------------------------------------- journal & rétention */
export async function auditLog(limit = 60): Promise<AuditRow[]> {
  try {
    const { data } = await adminDb().from("admin_audit").select("*").order("id", { ascending: false }).limit(limit);
    return (data ?? []) as AuditRow[];
  } catch {
    return [];
  }
}
export async function retentionStatus() {
  const log = await auditLog(200);
  const last = log.find((r) => r.action === "retention") ?? null;
  const { count: oldSessions } = await adminDb()
    .from("luma_sessions")
    .select("id", { count: "exact", head: true })
    .lt("created_at", new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString());
  const { count: oldWithContent } = await adminDb()
    .from("luma_messages")
    .select("id", { count: "exact", head: true })
    .neq("content", "")
    .lt("created_at", new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString());
  return { last, oldSessions: oldSessions ?? 0, pendingMessages: oldWithContent ?? 0 };
}
