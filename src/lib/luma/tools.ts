/**
 * Les outils de Luma (brief §3.3) : ils structurent l'affichage côté widget,
 * ils ne font rien côté serveur. Pas d'ajout au panier — le modèle montre, le
 * visiteur clique. Tous en mode strict : les arguments respectent le schéma.
 *
 * Les handles ne sont pas des enums dans le schéma, volontairement : les outils
 * précèdent le system prompt dans le préfixe de cache, et un catalogue qui
 * change ne doit pas invalider le cache. La validation se fait ici, contre le
 * catalogue vivant — un handle inconnu est une infraction, comme un mot
 * interdit, et déclenche une régénération.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { checkNumbers, checkOutput, type Violation } from "./guardrails";
import type { Knowledge } from "./knowledge";

const str = { type: "string" } as const;
const strOrNull = { type: ["string", "null"] } as const;

export const LUMA_TOOLS: Anthropic.Tool[] = [
  {
    name: "recommend_reflet",
    description:
      "À appeler chaque fois que Luma recommande : un Reflet, une alternative, une raison en une phrase. Les deux handles viennent du catalogue.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        reflet: { ...str, description: "Handle du Reflet ou du coffret recommandé." },
        alternative: { ...str, description: "Handle de l'alternative." },
        reason: { ...str, description: "Ce qui les distingue, en une phrase, dans la langue de la conversation." },
      },
      required: ["reflet", "alternative", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "show_product",
    description: "Affiche un produit du catalogue dans la conversation, quand Luma le nomme précisément.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { handle: { ...str, description: "Handle du produit." } },
      required: ["handle"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_email_capture",
    description:
      "Fait apparaître le champ email dans la conversation, avec le prétexte choisi par Luma (ex. envoyer la fiche d'un Reflet pour la retrouver). Jamais si l'email est déjà connu.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { pretext: { ...str, description: "La phrase de Luma qui justifie la demande, dans la langue de la conversation." } },
      required: ["pretext"],
      additionalProperties: false,
    },
  },
  {
    name: "handoff_to_human",
    description:
      "Passe la main à la Maison (contact@maisonreflet.com) pour tout ce qui relève du service : commande, livraison en cours, réclamation.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { reason: { ...str, description: "Le motif, en quelques mots." } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "log_profile_signal",
    description:
      "Enregistre ce que Luma apprend du visiteur, dès qu'elle l'apprend : ce qu'il porte, le parfum d'origine cité, pour qui, l'occasion. Un champ inconnu reste null.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        wearsToday: { ...strOrNull, description: "Ce que le visiteur porte ou aime aujourd'hui." },
        citedOrigin: { ...strOrNull, description: "Le parfum d'origine cité par le visiteur (ex. Baccarat Rouge 540)." },
        // Le mode strict refuse un enum sur un type union : « unknown » tient lieu de null.
        forWhom: { type: "string", enum: ["self", "gift", "unknown"], description: "Pour lui-même (self), pour offrir (gift), ou unknown si le visiteur ne l'a pas dit." },
        occasion: { ...strOrNull, description: "L'occasion, si cadeau (Eid, mariage, anniversaire…)." },
      },
      required: ["wearsToday", "citedOrigin", "forWhom", "occasion"],
      additionalProperties: false,
    },
  },
];

export type LumaAction =
  | { type: "recommend_reflet"; reflet: string; alternative: string; reason: string }
  | { type: "show_product"; handle: string }
  | { type: "propose_email_capture"; pretext: string }
  | { type: "handoff_to_human"; reason: string }
  | {
      type: "log_profile_signal";
      wearsToday: string | null;
      citedOrigin: string | null;
      forWhom: "self" | "gift" | null;
      occasion: string | null;
    };

/**
 * Lit les appels d'outils d'une réponse et les vérifie contre le catalogue et
 * les garde-fous. Les textes libres (raison, prétexte) sont affichés au
 * visiteur : ils passent les mêmes interdits que la réponse.
 */
export function extractActions(
  message: Anthropic.Message,
  knowledge: Knowledge
): { actions: LumaAction[]; violations: Violation[] } {
  const actions: LumaAction[] = [];
  const violations: Violation[] = [];
  const allowed = new Set(knowledge.allowedHandles);

  const handle = (value: unknown, field: string): string => {
    const h = typeof value === "string" ? value.trim() : "";
    if (!allowed.has(h)) violations.push({ rule: "produit inconnu", match: `${field}=${h || "∅"}` });
    return h;
  };
  const shown = (value: unknown): string => {
    const text = typeof value === "string" ? value : "";
    violations.push(...checkOutput(text), ...checkNumbers(text, knowledge.allowedNumbers, knowledge.allowedDelays));
    return text;
  };

  for (const block of message.content) {
    if (block.type !== "tool_use") continue;
    const input = (block.input ?? {}) as Record<string, unknown>;
    switch (block.name) {
      case "recommend_reflet":
        actions.push({
          type: "recommend_reflet",
          reflet: handle(input.reflet, "reflet"),
          alternative: handle(input.alternative, "alternative"),
          reason: shown(input.reason),
        });
        break;
      case "show_product":
        actions.push({ type: "show_product", handle: handle(input.handle, "handle") });
        break;
      case "propose_email_capture":
        actions.push({ type: "propose_email_capture", pretext: shown(input.pretext) });
        break;
      case "handoff_to_human":
        actions.push({ type: "handoff_to_human", reason: typeof input.reason === "string" ? input.reason : "" });
        break;
      case "log_profile_signal":
        actions.push({
          type: "log_profile_signal",
          wearsToday: (input.wearsToday as string | null) ?? null,
          citedOrigin: (input.citedOrigin as string | null) ?? null,
          forWhom: input.forWhom === "self" || input.forWhom === "gift" ? input.forWhom : null,
          occasion: (input.occasion as string | null) ?? null,
        });
        break;
      default:
        violations.push({ rule: "outil inconnu", match: block.name });
    }
  }
  return { actions, violations };
}
