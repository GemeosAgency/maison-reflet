/**
 * Persistance de Luma — le SEUL module qui parle à Supabase.
 *
 * Clé service_role, côté serveur uniquement : RLS est active sans politique
 * (migration 0001) et seule cette clé a des droits (0002). Le visiteur est un
 * `anon_id` opaque porté par un cookie first-party ; son email, s'il le donne,
 * vit dans une colonne à part que la rétention efface seule.
 *
 * Une « session » est une visite : la conversation reprend tant que le
 * visiteur revient dans les six heures, puis repart à neuf — en gardant ce que
 * Luma a appris (dernier profil), sans rejouer un vieux transcript.
 *
 * La base est à Mumbai : chaque aller-retour coûte des centaines de
 * millisecondes. D'où `visitorOf`, qui lit une fois ce dont tout le tour a
 * besoin, et des fonctions qui prennent les ids plutôt que de les relire.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "../../i18n";
import type { AgentReply } from "./agent";
import type { VisitContext } from "./persona";
import type { LumaAction } from "./tools";

const SESSION_IDLE_MS = 6 * 60 * 60 * 1000;
const HISTORY_TURNS = 20;

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url =
    (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ?? import.meta.env?.SUPABASE_URL;
  const key =
    (typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined) ??
    import.meta.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante — voir .env.example § Luma.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function fail(where: string, error: { message: string } | null): never {
  throw new Error(`[luma/store] ${where} : ${error?.message ?? "erreur inconnue"}`);
}

export type Session = {
  id: string;
  anon_id: string;
  locale: Locale;
  country: string | null;
  currency: string | null;
  initiative: string | null;
  email: string | null;
};

/** Ce qu'on sait du visiteur en UNE lecture : ses sessions, son email, la session encore chaude. */
export type Visitor = {
  sessionIds: string[];
  email: string | null;
  /** La session la plus récente si elle date de moins de six heures, dans la même langue. */
  live: Session | null;
};

export async function visitorOf(anonId: string, locale: Locale): Promise<Visitor> {
  const { data, error } = await db()
    .from("luma_sessions")
    .select("id, anon_id, locale, country, currency, initiative, email, last_seen_at")
    .eq("anon_id", anonId)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (error) fail("lecture visiteur", error);
  const rows = (data ?? []) as (Session & { last_seen_at: string })[];
  const since = Date.now() - SESSION_IDLE_MS;
  const recent = rows[0];
  const live =
    recent && recent.locale === locale && Date.parse(recent.last_seen_at) >= since ? recent : null;
  return {
    sessionIds: rows.map((r) => r.id),
    email: rows.find((r) => r.email)?.email ?? null,
    live,
  };
}

export async function resumeOrCreateSession(
  visitor: Visitor,
  anonId: string,
  locale: Locale,
  country: string,
  currency: string
): Promise<Session> {
  if (visitor.live) {
    // Pas d'attente : la mise à jour n'a rien à apporter au tour en cours.
    void db()
      .from("luma_sessions")
      .update({ last_seen_at: new Date().toISOString(), country, currency })
      .eq("id", visitor.live.id)
      .then(({ error }) => error && console.error("[luma/store] last_seen_at :", error.message));
    return visitor.live;
  }
  const { data, error } = await db()
    .from("luma_sessions")
    .insert({ anon_id: anonId, locale, country, currency })
    .select("id, anon_id, locale, country, currency, initiative, email")
    .single();
  if (error || !data) fail("création session", error);
  return data as Session;
}

/** Les derniers tours, texte seul, en commençant toujours par le visiteur. */
export async function loadHistory(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const { data, error } = await db()
    .from("luma_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .neq("content", "")
    .order("id", { ascending: false })
    .limit(HISTORY_TURNS * 2);
  if (error) fail("lecture historique", error);
  const rows = (data ?? []).reverse() as { role: "user" | "assistant"; content: string }[];
  const firstUser = rows.findIndex((r) => r.role === "user");
  return firstUser < 0 ? [] : rows.slice(firstUser).map((r) => ({ role: r.role, content: r.content }));
}

export async function recordUserMessage(sessionId: string, content: string): Promise<void> {
  const { error } = await db().from("luma_messages").insert({ session_id: sessionId, role: "user", content });
  if (error) fail("écriture message visiteur", error);
}

export async function recordAssistantMessage(sessionId: string, reply: AgentReply): Promise<void> {
  const { error } = await db().from("luma_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: reply.text,
    model: reply.model,
    // Volume total traité en entrée (cache compris) : c'est ce que compte le plafond.
    tokens_in: reply.usage.inputTokens + reply.usage.cacheReadTokens + reply.usage.cacheWriteTokens,
    tokens_out: reply.usage.outputTokens,
    violations: reply.violations,
    regenerated: reply.regenerated,
  });
  if (error) fail("écriture message Luma", error);
}

/** Ce que Luma a appris : une ligne par session, écrasée à mesure (persona §10). */
export async function upsertSignals(sessionId: string, actions: LumaAction[]): Promise<void> {
  const patch: Record<string, string> = {};
  for (const a of actions) {
    if (a.type === "recommend_reflet") {
      patch.recommended_handle = a.reflet;
      patch.alternative_handle = a.alternative;
    }
    if (a.type === "log_profile_signal") {
      if (a.wearsToday) patch.wears_today = a.wearsToday;
      if (a.citedOrigin) patch.cited_origin = a.citedOrigin;
      if (a.forWhom) patch.for_whom = a.forWhom;
      if (a.occasion) patch.occasion = a.occasion;
    }
  }
  if (!Object.keys(patch).length) return;
  const { error } = await db()
    .from("luma_profile_signals")
    .upsert({ session_id: sessionId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "session_id" });
  if (error) fail("écriture signaux", error);
}

/** Le dernier profil connu de ce visiteur, toutes sessions confondues. */
export async function latestProfile(visitor: Visitor): Promise<NonNullable<VisitContext["profile"]>> {
  if (!visitor.sessionIds.length) return { email: visitor.email };
  const { data, error } = await db()
    .from("luma_profile_signals")
    .select("session_id, recommended_handle, alternative_handle, cited_origin, for_whom, occasion, wears_today")
    .in("session_id", visitor.sessionIds)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) fail("lecture signaux", error);
  const s = data?.[0];
  return {
    recommended: s?.recommended_handle ?? null,
    alternative: s?.alternative_handle ?? null,
    citedOrigin: s?.cited_origin ?? null,
    forWhom: s?.for_whom ?? null,
    occasion: s?.occasion ?? null,
    wearsToday: s?.wears_today ?? null,
    email: visitor.email,
    fromPreviousVisit: Boolean(s) && s.session_id !== visitor.live?.id,
  };
}

/** L'email donné par le visiteur, sur sa session vivante — la rétention l'effacera seul. */
export async function setSessionEmail(sessionId: string, email: string): Promise<void> {
  const { error } = await db().from("luma_sessions").update({ email }).eq("id", sessionId);
  if (error) fail("écriture email", error);
}

export async function logEvent(sessionId: string | null, name: string, props: Record<string, unknown> = {}): Promise<void> {
  const { error } = await db().from("luma_events").insert({ session_id: sessionId, name, props });
  // Le journal ne doit jamais faire échouer la réponse.
  if (error) console.error("[luma/store] événement non journalisé :", error.message);
}

/**
 * Messages du visiteur sur 24 h, en une lecture — l'appelant en tire ses deux
 * compteurs (minute, jour) sans second aller-retour.
 */
export async function userMessageTimes(visitor: Visitor): Promise<number[]> {
  if (!visitor.sessionIds.length) return [];
  const { data, error } = await db()
    .from("luma_messages")
    .select("created_at")
    .in("session_id", visitor.sessionIds)
    .eq("role", "user")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .limit(500);
  if (error) fail("lecture débit", error);
  return (data ?? []).map((r) => Date.parse(r.created_at as string));
}

/** Tokens consommés depuis minuit UTC, tous visiteurs — pour le plafond quotidien. */
export async function tokensToday(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from("luma_messages")
    .select("tokens_in, tokens_out")
    .eq("role", "assistant")
    .gte("created_at", start.toISOString())
    .limit(5000);
  if (error) fail("lecture consommation", error);
  return (data ?? []).reduce((sum, r) => sum + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0);
}
