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
import { LUMA_TOOLS, extractActions, productsNamedIn, type LumaAction } from "./tools";

export const LUMA_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;
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

type Attempt = { text: string; actions: LumaAction[]; violations: Violation[]; message: Anthropic.Message };

async function generate(input: AnswerInput, reminder?: string): Promise<Attempt> {
  const message = await getClient().messages.create({
    model: LUMA_MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: buildSystemBlocks(input.knowledge, input.context, input.now, reminder),
    tools: LUMA_TOOLS,
    tool_choice: { type: "auto" },
    messages: [...input.history, { role: "user", content: input.userMessage }],
  });

  const text = textOf(message);
  const { actions, violations } = extractActions(message, input.knowledge);
  // La fiche accompagne toujours un Reflet nommé (Sandro, 11 septembre 2026) :
  // si le modèle a parlé d'un produit sans appeler l'outil, la carte du premier
  // produit nommé s'ajoute ici — ce n'est pas une infraction, c'est un oubli.
  if (!actions.some((a) => a.type === "recommend_reflet" || a.type === "show_product")) {
    const named = productsNamedIn(text, input.knowledge);
    if (named[0]) actions.push({ type: "show_product", handle: named[0].handle });
  }
  violations.push(
    ...checkOutput(text),
    ...checkNumbers(text, input.knowledge.allowedNumbers, input.knowledge.allowedDelays)
  );
  if (!text) violations.push({ rule: "réponse sans texte", match: "∅" });
  if (message.stop_reason === "max_tokens") violations.push({ rule: "réponse coupée", match: "max_tokens" });
  return { text, actions, violations, message };
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
        regenerated: false,
        fallback: true,
      };
    }
    if (first.violations.length === 0) {
      return { ...pick(first), model: first.message.model, usage, violations: [], regenerated: false, fallback: false };
    }
    allViolations.push(...first.violations);

    const second = await generate(input, reminderFor(first.violations));
    usage = addUsage(usage, second.message.usage);
    if (second.message.stop_reason !== "refusal" && second.violations.length === 0) {
      return { ...pick(second), model: second.message.model, usage, violations: allViolations, regenerated: true, fallback: false };
    }
    allViolations.push(...second.violations);
    return {
      text: FALLBACK_REPLY[input.locale](contact),
      actions: [],
      model: second.message.model,
      usage,
      violations: allViolations,
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
      regenerated: false,
      fallback: true,
      error: detail,
    };
  }
}

function pick(a: Attempt): Pick<AgentReply, "text" | "actions"> {
  return { text: a.text, actions: a.actions };
}
