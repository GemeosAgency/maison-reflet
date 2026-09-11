/**
 * Un tour de conversation avec Luma : prompt, appel Claude, garde-fous,
 * régénération, secours. Pur côté données — la persistance (Supabase) et le
 * transport (SSE) vivent dans la route, ce qui garde ce module testable en CLI.
 *
 * Le modèle n'est jamais le dernier rempart sur les règles de marque : la
 * sortie est vérifiée par du code (guardrails.ts), régénérée UNE fois avec le
 * rappel nommant la faute, puis remplacée par une réponse de secours. Les
 * appels d'outils passent les mêmes contrôles que le texte.
 *
 * Modèle : `claude-sonnet-5`, nommé par le brief (§3.3). Le brief demandait
 * aussi une « température basse » : le paramètre n'existe plus sur ce modèle ;
 * l'équivalent est une réflexion adaptative à effort bas, qui garde les
 * réponses courtes et régulières. `max_tokens` est volontairement modeste —
 * deux à quatre phrases par message, c'est la règle — mais laisse la place à
 * la réflexion, qui compte dans ce plafond.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "../../i18n";
import { checkNumbers, checkOutput, reminderFor, type Violation } from "./guardrails";
import type { Knowledge } from "./knowledge";
import { FALLBACK_REPLY, UNAVAILABLE_REPLY, buildSystemBlocks, type VisitContext } from "./persona";
import { SCRIPT_MAX_CHARS, stripTags } from "./voice";
import {
  LUMA_TOOLS,
  extractActions,
  fallbackReplies,
  normalizeReplies,
  productsNamedIn,
  repliesFromQuestion,
  type LumaAction,
} from "./tools";

export const LUMA_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;
// Avec la voix, la réponse porte aussi son script parlé (~250 tokens) : plus de place, sinon elle est coupée.
const MAX_TOKENS_VOICE = 1700;
const REQUEST_TIMEOUT_MS = 25_000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  // process.env en route Vercel comme en CLI ; import.meta.env en SSR Astro.
  const apiKey =
    (typeof process !== "undefined" ? process.env.ANTHROPIC_API_KEY : undefined) ??
    import.meta.env?.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante — voir .env.example § Luma.");
  client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

export type AnswerInput = {
  knowledge: Knowledge;
  locale: Locale;
  /** Tours précédents, texte seul (les appels d'outils sont des effets, pas de l'historique). */
  history: Anthropic.MessageParam[];
  userMessage: string;
  context?: VisitContext;
  now?: Date;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type AgentReply = {
  text: string;
  actions: LumaAction[];
  model: string;
  usage: Usage;
  /** Infractions relevées, y compris celles corrigées par la régénération. */
  violations: Violation[];
  /**
   * Manques « doux » de la première tentative — pas des infractions : une
   * recommandation sans question de suite, des réponses toutes faites
   * oubliées. Ils valent une seconde chance, jamais une réponse de secours.
   */
  soft: Violation[];
  /** D'où viennent les réponses toutes faites : le modèle, le complément, la question elle-même, ou le secours générique. */
  chipsSource: "model" | "completion" | "question" | "fallback" | "none";
  regenerated: boolean;
  /** Réponse de secours servie (deux régénérations fautives, refus, panne). */
  fallback: boolean;
  /** Renseigné quand l'API a échoué — pour le journal, jamais pour le visiteur. */
  error?: string;
};

const EMPTY_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

function addUsage(total: Usage, u: Anthropic.Usage): Usage {
  return {
    inputTokens: total.inputTokens + u.input_tokens,
    outputTokens: total.outputTokens + u.output_tokens,
    cacheReadTokens: total.cacheReadTokens + (u.cache_read_input_tokens ?? 0),
    cacheWriteTokens: total.cacheWriteTokens + (u.cache_creation_input_tokens ?? 0),
  };
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

type Attempt = {
  text: string;
  actions: LumaAction[];
  violations: Violation[];
  soft: Violation[];
  chipsSource: AgentReply["chipsSource"];
  message: Anthropic.Message;
};

async function generate(input: AnswerInput, reminder?: string): Promise<Attempt> {
  const message = await getClient().messages.create({
    model: LUMA_MODEL,
    max_tokens: input.context?.voice ? MAX_TOKENS_VOICE : MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: buildSystemBlocks(input.knowledge, input.context, input.now, reminder),
    tools: LUMA_TOOLS,
    tool_choice: { type: "auto" },
    messages: [...input.history, { role: "user", content: input.userMessage }],
  });

  const text = textOf(message);
  const extracted = extractActions(message, input.knowledge, input.userMessage);
  const actions = normalizeReplies(extracted.actions, input.knowledge);
  const violations = extracted.violations;
  // La fiche accompagne toujours un Reflet nommé (Sandro, 11 septembre 2026),
  // et dans une comparaison CHAQUE Reflet comparé a la sienne : tout produit
  // nommé dans le texte et absent des outils reçoit sa fiche ici. Un ou deux
  // produits nommés : recommandation ou comparaison. Trois ou plus : panorama
  // de la collection, pas de fiche isolée.
  const named = productsNamedIn(text, input.knowledge);
  if (named.length > 0 && named.length <= 2) {
    const covered = new Set(
      actions.flatMap((a) =>
        a.type === "recommend_reflet" ? [a.reflet, a.alternative] : a.type === "show_product" ? [a.handle] : []
      )
    );
    for (const p of named) if (!covered.has(p.handle)) actions.push({ type: "show_product", handle: p.handle });
  }
  violations.push(
    ...checkOutput(text),
    ...checkNumbers(text, input.knowledge.allowedNumbers, input.knowledge.allowedDelays)
  );
  if (!text) violations.push({ rule: "réponse sans texte", match: "∅" });
  if (message.stop_reason === "max_tokens") violations.push({ rule: "réponse coupée", match: "max_tokens" });

  // Les deux règles de Sandro (11 septembre 2026) que le modèle oublie parfois :
  // la conversation continue, et le visiteur a toujours de quoi cliquer.
  const soft: Violation[] = [];
  if (!actions.some((a) => a.type === "suggest_replies")) soft.push({ rule: "réponses toutes faites manquantes", match: "suggest_replies" });
  const lastParagraph = text.split(/\n+/).filter(Boolean).pop() ?? "";
  if (recommends(actions) && text && !/[?؟]/.test(lastParagraph)) {
    soft.push({ rule: "recommandation sans question de suite", match: lastParagraph.slice(-60) });
  }
  if (input.context?.voice && text && !actions.some((a) => a.type === "speak")) {
    soft.push({ rule: "script parlé manquant", match: "speak" });
  }
  return { text, actions, violations, soft, chipsSource: soft.some((v) => v.match === "suggest_replies") ? "none" : "model", message };
}

function recommends(actions: LumaAction[]): boolean {
  return actions.some((a) => a.type === "recommend_reflet" || a.type === "show_product");
}

function completeInstruction(voice: boolean): string {
  return (
    "[Consigne de la Maison — le visiteur ne voit pas ce message] Complète ta dernière réponse sans la réécrire. Réponds uniquement par un objet JSON, sans autre texte : " +
    '{"question": "la question courte, dans la langue de la conversation, qui vérifie le choix et continue l\'échange (jour ou soir, présence ou discrétion, déjà senti, pour qui) — ou une chaîne vide si ta réponse se termine déjà par une question", ' +
    '"replies": ["deux à quatre réponses courtes, formulées comme le visiteur les dirait, dans la langue de la conversation : les réponses possibles à la question posée à la fin de ta réponse (occasion → des occasions ; jour ou soir → jour ou soir ; ce qu\'il porte → les parfums d\'origine de la collection), ou les suites de ta proposition s\'il n\'y a pas de question ; jamais ce que le visiteur vient de dire"]' +
    (voice
      ? ', "script": "une note vocale de 280 caractères au plus (la recommandation, une image sensorielle, la question — l\'écran porte le reste), écrite pour l\'oral : phrases courtes, un Hmm… ou un alors pour respirer, [inhales] avant la recommandation, [exhales] avant la chute, l\'intention en tête entre crochets ([upbeat] d\'ordinaire, [warmly] pour un cadeau), [curious] devant la question finale formulée en Est-ce que… ; mêmes noms, mêmes chiffres, mêmes prix que ta réponse écrite"'
      : "") +
    "}"
  );
}

/**
 * Complète une réponse propre mais incomplète — sans question de suite, ou
 * sans réponses toutes faites — par un petit appel sans réflexion (~2 s) qui
 * ne renvoie que ce qui manque. Régénérer toute la réponse coûtait 6 à 8 s et
 * le modèle ratait parfois la seconde. Tout ce qui revient passe les garde-fous
 * avant d'être ajouté ; si rien d'utilisable ne revient, le code fournit des
 * réponses toutes faites de secours et la réponse reste telle quelle.
 */
async function complete(a: Attempt, input: AnswerInput): Promise<{ attempt: Attempt; usage: Anthropic.Usage | null }> {
  const needsQuestion = a.soft.some((v) => v.rule === "recommandation sans question de suite");
  const needsChips = a.soft.some((v) => v.rule === "réponses toutes faites manquantes");
  const clean = (s: string) =>
    checkOutput(s).length === 0 && checkNumbers(s, input.knowledge.allowedNumbers, input.knowledge.allowedDelays).length === 0;
  try {
    // Mêmes outils, même réflexion que le tour : le préfixe de cache (outils +
    // persona + catalogue) est relu, pas réécrit. tool_choice none : du texte.
    const res = await getClient().messages.create({
      model: LUMA_MODEL,
      // Avec la voix, le complément porte aussi le script parlé (~250 tokens) : sinon le JSON est coupé.
      max_tokens: input.context?.voice ? 900 : 300,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: buildSystemBlocks(input.knowledge, input.context, input.now),
      tools: LUMA_TOOLS,
      tool_choice: { type: "none" },
      messages: [
        ...input.history,
        { role: "user", content: input.userMessage },
        { role: "assistant", content: a.text },
        { role: "user", content: completeInstruction(Boolean(input.context?.voice)) },
      ],
    });
    // Le modèle entoure parfois le JSON de texte ou de clôtures : on prend le premier objet.
    const raw = textOf(res).match(/\{[\s\S]*\}/)?.[0] ?? "";
    if (typeof process !== "undefined" && process.env.LUMA_DEBUG) console.error("[luma/agent] complément brut :", textOf(res).slice(0, 1500));
    const parsed = JSON.parse(raw) as { question?: unknown; replies?: unknown; script?: unknown };
    const needsScript = a.soft.some((v) => v.rule === "script parlé manquant");

    let text = a.text;
    let actions = a.actions;
    let chipsSource = a.chipsSource;
    const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
    if (needsQuestion && question && question.length <= 160 && /[?؟]$/.test(question) && clean(question)) {
      text = `${text}\n\n${question}`;
    }
    if (needsChips) {
      const replies = (Array.isArray(parsed.replies) ? parsed.replies : [])
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter((r) => r.length > 0 && r.length <= 60 && r.toLowerCase() !== input.userMessage.trim().toLowerCase() && clean(r))
        .slice(0, 6);
      if (replies.length >= 2) {
        actions = normalizeReplies([...actions, { type: "suggest_replies", replies }], input.knowledge);
        chipsSource = "completion";
      }
    }
    if (needsScript && typeof parsed.script === "string") {
      const script = parsed.script.trim().slice(0, SCRIPT_MAX_CHARS);
      // Le script doit porter la question ajoutée : sinon la voix s'arrête avant le texte.
      if (script && clean(stripTags(script))) actions = [...actions, { type: "speak", script }];
    }
    return { attempt: withFallbackChips({ ...a, text, actions, chipsSource }, input), usage: res.usage };
  } catch (error) {
    console.error("[luma/agent] complément non obtenu :", error instanceof Error ? error.message : String(error));
    return { attempt: withFallbackChips(a, input), usage: null };
  }
}

/**
 * Si les réponses toutes faites manquent encore, le code les fournit : d'abord
 * les deux options de la question elle-même quand elle en oppose deux, sinon
 * le jeu générique — toujours en rapport avec ce que Luma vient de dire.
 */
function withFallbackChips(a: Attempt, input: AnswerInput): Attempt {
  if (a.actions.some((x) => x.type === "suggest_replies")) return a;
  const fromQuestion = repliesFromQuestion(a.text);
  const replies = fromQuestion.length ? fromQuestion : fallbackReplies(input.locale, a.text, recommends(a.actions));
  return {
    ...a,
    chipsSource: fromQuestion.length ? "question" : "fallback",
    actions: [...a.actions, { type: "suggest_replies", replies }],
  };
}

export async function answer(input: AnswerInput): Promise<AgentReply> {
  const contact = input.knowledge.contactEmail;
  let usage = EMPTY_USAGE;
  const allViolations: Violation[] = [];

  try {
    const first = await generate(input);
    usage = addUsage(usage, first.message.usage);
    if (first.message.stop_reason === "refusal") {
      return {
        text: FALLBACK_REPLY[input.locale](contact),
        actions: [],
        model: first.message.model,
        usage,
        violations: [{ rule: "refus du modèle", match: first.message.stop_details?.category ?? "" }],
        soft: [],
        chipsSource: "none",
        regenerated: false,
        fallback: true,
      };
    }
    if (first.violations.length === 0) return finish(first, input, usage, [], false);
    allViolations.push(...first.violations);

    const second = await generate(input, reminderFor(first.violations));
    usage = addUsage(usage, second.message.usage);
    if (second.message.stop_reason !== "refusal" && second.violations.length === 0) {
      return finish(second, input, usage, allViolations, true);
    }
    allViolations.push(...second.violations);
    return {
      text: FALLBACK_REPLY[input.locale](contact),
      actions: [],
      model: second.message.model,
      usage,
      violations: allViolations,
      soft: [],
      chipsSource: "none",
      regenerated: true,
      fallback: true,
    };
  } catch (error) {
    // Du plus précis au plus général ; le visiteur ne voit jamais l'erreur.
    let detail: string;
    if (error instanceof Anthropic.RateLimitError) detail = "rate_limit";
    else if (error instanceof Anthropic.AuthenticationError) detail = "authentication";
    else if (error instanceof Anthropic.APIConnectionTimeoutError) detail = "timeout";
    // Le message de l'API est précieux pour le journal (schéma d'outil refusé,
    // paramètre inconnu…) — jamais montré au visiteur.
    else if (error instanceof Anthropic.APIError) detail = `api_${error.status ?? "error"}: ${error.message.slice(0, 400)}`;
    else detail = error instanceof Error ? error.message : String(error);
    return {
      text: UNAVAILABLE_REPLY[input.locale](contact),
      actions: [],
      model: LUMA_MODEL,
      usage,
      violations: allViolations,
      soft: [],
      chipsSource: "none",
      regenerated: false,
      fallback: true,
      error: detail,
    };
  }
}

function pick(a: Attempt): Pick<AgentReply, "text" | "actions"> {
  return { text: a.text, actions: a.actions };
}

/**
 * Une réponse propre : si la conversation s'arrête ou n'offre rien à cliquer,
 * le complément d'abord — quel que soit le chemin (première tentative ou
 * régénération) —, puis les réponses de secours en dernier recours.
 */
async function finish(a: Attempt, input: AnswerInput, usage: Usage, violations: Violation[], regenerated: boolean): Promise<AgentReply> {
  let attempt = a;
  let total = usage;
  if (a.soft.length) {
    const { attempt: completed, usage: extra } = await complete(a, input);
    attempt = completed;
    if (extra) total = addUsage(total, extra);
  }
  return {
    ...pick(attempt),
    model: a.message.model,
    usage: total,
    violations,
    soft: a.soft,
    chipsSource: attempt.chipsSource,
    regenerated,
    fallback: false,
  };
}
