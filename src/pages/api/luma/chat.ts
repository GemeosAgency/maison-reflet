import type { APIRoute } from "astro";
import { localePath, locales, type Locale } from "../../../i18n";
import { COUNTRY_COOKIE, getCountry, isShippedCountry } from "../../../lib/markets";
import { answer } from "../../../lib/luma/agent";
import { CONTACT_EMAIL } from "../../../lib/luma/collection";
import { findProduct, type Knowledge, type KnowledgeProduct } from "../../../lib/luma/knowledge";
import { getKnowledge } from "../../../lib/luma/knowledge-live";
import type { LumaAction } from "../../../lib/luma/tools";
import { UNAVAILABLE_REPLY, type VisitContext } from "../../../lib/luma/persona";
import {
  latestProfile,
  loadHistory,
  logEvent,
  recordAssistantMessage,
  recordUserMessage,
  resumeOrCreateSession,
  tokensToday,
  upsertSignals,
  userMessageTimes,
  visitorOf,
} from "../../../lib/luma/store";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

/**
 * Un tour de conversation avec Luma.
 *
 * Entrée : `{ message, locale, context? }`. Sortie : un flux SSE de lignes
 * `data: {...}` — `status` (Luma réfléchit), `text` (la réponse), `action`
 * (un appel d'outil à afficher), `done`. La réponse est VÉRIFIÉE avant d'être
 * envoyée (décision du 11 septembre 2026 : aucun interdit ne doit s'afficher,
 * même une seconde) ; le widget fait l'effet de frappe. Le protocole est celui
 * du brief, pour passer au vrai streaming sans changer le client.
 *
 * Refus AVANT le flux (JSON, code HTTP) : origine étrangère (403), requête
 * invalide (400). Tout le reste — débit, plafond, panne — se dit DANS le flux,
 * par la phrase d'indisponibilité : le visiteur a toujours une réponse, jamais
 * une page cassée (brief §7), et le premier octet part sans attendre la base.
 *
 * Latence : la base est à Mumbai, chaque aller-retour compte. Tout ce qui est
 * indépendant part en parallèle, et le texte est envoyé AVANT les écritures.
 * L'événement `reply` garde les temps par phase, pour mesurer plutôt que
 * supposer.
 */

const SESSION_COOKIE = "mr_luma";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const MESSAGE_MAX_CHARS = 1000;
// Par visiteur : de quoi converser, pas de quoi scripter.
const RATE_PER_MINUTE = 8;
const RATE_PER_DAY = 150;
// Tous visiteurs, entrée + sortie, cache compris (brief §7 « plafond quotidien »).
const DAILY_TOKEN_CAP = Number(import.meta.env.LUMA_DAILY_TOKEN_CAP) || 1_500_000;

/**
 * Ce que le widget affiche d'un produit — nom, visuel, lien localisé, prix,
 * variante à ajouter au panier (décision de Sandro du 11 septembre 2026 : la
 * fiche est complète, prix visible et boutons du site). La disponibilité se
 * dit, ne se compte pas.
 */
function card(p: KnowledgeProduct, lang: Locale) {
  const main = p.variants.find((v) => !v.sample) ?? p.variants[0];
  return {
    handle: p.handle,
    name: p.name,
    kind: p.kind,
    url: localePath(lang, `${p.kind === "coffret" ? "/coffrets/" : "/parfums/"}${p.handle}`),
    image: p.image,
    price: main ? `${main.price} ${main.currency}` : null,
    available: p.available,
    variantId: main?.id ?? null,
  };
}

/**
 * Les actions telles que le client les reçoit. Les signaux de profil restent
 * côté serveur : ils nourrissent la base et Klaviyo, pas l'écran.
 */
function forClient(action: LumaAction, knowledge: Knowledge, lang: Locale): Record<string, unknown> | null {
  switch (action.type) {
    case "recommend_reflet": {
      const reflet = findProduct(knowledge, action.reflet);
      const alternative = findProduct(knowledge, action.alternative);
      if (!reflet) return null;
      return {
        type: action.type,
        reflet: card(reflet, lang),
        alternative: alternative ? card(alternative, lang) : null,
        reason: action.reason,
      };
    }
    case "show_product": {
      const product = findProduct(knowledge, action.handle);
      return product ? { type: action.type, product: card(product, lang) } : null;
    }
    case "propose_email_capture":
      return { type: action.type, pretext: action.pretext };
    case "handoff_to_human":
      return { type: action.type, email: CONTACT_EMAIL, reason: action.reason };
    case "suggest_replies":
      return { type: action.type, replies: action.replies };
    case "log_profile_signal":
      return null;
  }
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function parseLocale(value: unknown): Locale | null {
  const v = String(value ?? "").trim().toLowerCase();
  return (locales as readonly string[]).includes(v) ? (v as Locale) : null;
}

/** Le contexte de visite envoyé par le widget, borné champ par champ. */
function parseContext(value: unknown): VisitContext {
  const ctx: VisitContext = {};
  if (!value || typeof value !== "object") return ctx;
  const v = value as Record<string, unknown>;
  const page = v.page as Record<string, unknown> | undefined;
  if (page && typeof page.type === "string") {
    ctx.page = { type: page.type.slice(0, 32), handle: typeof page.handle === "string" ? page.handle.slice(0, 64) : null };
  }
  if (typeof v.entry === "string") ctx.entry = v.entry.slice(0, 32);
  const cart = v.cart as Record<string, unknown> | undefined;
  if (cart && Array.isArray(cart.lines)) {
    ctx.cart = {
      lines: cart.lines.slice(0, 20).flatMap((l) => {
        const line = l as Record<string, unknown>;
        return typeof line.handle === "string" && typeof line.title === "string"
          ? [{ handle: line.handle.slice(0, 64), title: line.title.slice(0, 80), quantity: Number(line.quantity) || 1 }]
          : [];
      }),
    };
  }
  return ctx;
}

/** Même site ou rien : le widget vit sur maisonreflet.com, pas ailleurs. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // appels serveur et tests ; le navigateur envoie toujours Origin sur un POST
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request)) return json({ ok: false, error: "Origine refusée." }, 403);

  let message = "";
  let locale: Locale | null = null;
  let context: VisitContext = {};
  try {
    const body = await request.json();
    message = String(body?.message ?? "").trim();
    locale = parseLocale(body?.locale);
    context = parseContext(body?.context);
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400);
  }
  if (!locale) return json({ ok: false, error: "Langue invalide." }, 400);
  if (!message || message.length > MESSAGE_MAX_CHARS) return json({ ok: false, error: "Message vide ou trop long." }, 400);
  const lang: Locale = locale;

  // Pays : le choix du visiteur (cookie du sélecteur), sinon l'infrastructure.
  const cookieCountry = cookies.get(COUNTRY_COOKIE)?.value;
  const country = getCountry(
    isShippedCountry(cookieCountry) ? cookieCountry : request.headers.get("x-vercel-ip-country")
  );

  // Session : cookie first-party opaque, 30 jours, jamais lisible par un script.
  const anonId = cookies.get(SESSION_COOKIE)?.value || crypto.randomUUID();
  cookies.set(SESSION_COOKIE, anonId, {
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: import.meta.env.PROD,
  });

  const unavailable = UNAVAILABLE_REPLY[lang](CONTACT_EMAIL);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const t0 = Date.now();
      const phases: Record<string, number> = {};
      let lap = t0;
      const mark = (name: string) => {
        const now = Date.now();
        phases[name] = now - lap;
        lap = now;
      };
      let sessionId: string | null = null;

      try {
        send({ type: "status", state: "thinking" });

        // Catalogue (cache 60 s) et visiteur : rien ne dépend de l'autre.
        const [knowledge, visitor] = await Promise.all([
          getKnowledge({ country: country.code, locale: lang }),
          visitorOf(anonId, lang),
        ]);
        mark("lookup_ms");

        // Débit par visiteur, avant tout appel payant.
        const times = await userMessageTimes(visitor);
        const perMinute = times.filter((t) => t >= t0 - 60_000).length;
        if (perMinute >= RATE_PER_MINUTE || times.length >= RATE_PER_DAY) {
          await logEvent(visitor.live?.id ?? null, "rate_limited", { perMinute, perDay: times.length });
          send({ type: "text", text: unavailable });
          send({ type: "done", sessionId: visitor.live?.id ?? null, fallback: true, reason: "rate_limited" });
          return;
        }

        const session = await resumeOrCreateSession(visitor, anonId, lang, country.code, knowledge.logistics.currency);
        sessionId = session.id;

        const [history, profile, used] = await Promise.all([
          loadHistory(session.id),
          latestProfile(visitor),
          tokensToday(),
          // Le message du visiteur s'écrit pendant qu'on lit le reste : son id
          // précède de toute façon celui de la réponse, écrite après le modèle.
          recordUserMessage(session.id, message),
        ]);
        mark("db_ms");

        // Plafond du jour : Luma reste courtoise, le journal alerte.
        if (used >= DAILY_TOKEN_CAP) {
          console.error(`[luma/chat] PLAFOND QUOTIDIEN ATTEINT : ${used} tokens (cap ${DAILY_TOKEN_CAP}).`);
          await logEvent(session.id, "daily_cap", { used, cap: DAILY_TOKEN_CAP });
          send({ type: "text", text: unavailable });
          send({ type: "done", sessionId: session.id, fallback: true, reason: "daily_cap" });
          return;
        }

        const reply = await answer({
          knowledge,
          locale: lang,
          history,
          userMessage: message,
          context: { ...context, profile: { ...profile, ...(context.profile ?? {}) } },
        });
        mark("model_ms");

        // Le visiteur d'abord, la base ensuite.
        send({ type: "text", text: reply.text });
        for (const action of reply.actions) {
          const visible = forClient(action, knowledge, lang);
          if (visible) send({ type: "action", action: visible });
        }

        if (reply.fallback) console.error("[luma/chat] réponse de secours servie :", reply.error ?? reply.violations);
        const events: Promise<void>[] = [];
        for (const a of reply.actions) {
          if (a.type === "handoff_to_human") events.push(logEvent(session.id, "handoff", { reason: a.reason }));
          if (a.type === "propose_email_capture") events.push(logEvent(session.id, "email_capture_proposed", {}));
        }
        if (reply.fallback) events.push(logEvent(session.id, "fallback", { error: reply.error ?? null, violations: reply.violations }));
        await Promise.all([recordAssistantMessage(session.id, reply), upsertSignals(session.id, reply.actions), ...events]);
        mark("persist_ms");

        await logEvent(session.id, "reply", {
          total_ms: Date.now() - t0,
          ...phases,
          regenerated: reply.regenerated,
          violations: reply.violations.length,
          soft: reply.soft.map((v) => v.rule),
          chips: reply.chipsSource,
          entry: context.entry ?? null,
          page: context.page?.type ?? null,
          actions: reply.actions.map((a) => a.type),
          tokens_out: reply.usage.outputTokens,
          cache_read: reply.usage.cacheReadTokens,
        });
        send({ type: "done", sessionId: session.id, fallback: reply.fallback });
      } catch (error) {
        console.error("[luma/chat] échec du tour :", error);
        try {
          await logEvent(sessionId, "error", { message: error instanceof Error ? error.message : String(error) });
        } catch {
          /* le journal lui-même est en panne : rien à faire de plus */
        }
        send({ type: "text", text: unavailable });
        send({ type: "done", sessionId, fallback: true, reason: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
