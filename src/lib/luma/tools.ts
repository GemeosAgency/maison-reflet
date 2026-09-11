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
import type { Locale } from "../../i18n";
import { checkNumbers, checkOutput, type Violation } from "./guardrails";
import { SCRIPT_MAX_CHARS, stripTags } from "./voice";
import type { Knowledge, KnowledgeProduct } from "./knowledge";

const str = { type: "string" } as const;
const strOrNull = { type: ["string", "null"] } as const;

// Réponses toutes faites : deux à quatre d'ordinaire, six quand ce sont les parfums d'origine — plus la porte de sortie.
const MAX_REPLIES = 7;
const MAX_REPLY_CHARS = 60;

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
    description: "Affiche un produit du catalogue dans la conversation, quand Luma le nomme précisément. Dans une comparaison, un appel par produit comparé.",
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
    name: "suggest_replies",
    description:
      "Propose au visiteur des réponses toutes faites, cliquables, sous ta phrase : deux à quatre (six quand ce sont les parfums d'origine de la collection), courtes, dans la langue de la conversation, formulées comme le visiteur les dirait. Ce sont les réponses possibles à la question que tu poses dans ce message (occasion → des occasions ; jour ou soir → jour ou soir ; ce qu'il porte → les parfums d'origine), ou les suites de ta proposition s'il n'y a pas de question. Jamais une réponse hors sujet, jamais ce que le visiteur vient de dire. À appeler à chaque message.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        replies: {
          type: "array",
          items: { type: "string" },
          description: "Les réponses proposées, dans l'ordre d'affichage, moins de 40 caractères chacune.",
        },
      },
      required: ["replies"],
      additionalProperties: false,
    },
  },
  {
    name: "speak",
    description:
      "Seulement quand le contexte dit « voix activée » : une note vocale de 280 caractères au plus — la recommandation, une image sensorielle, la question ; l'écran porte le reste. Écrite pour l'oral : phrases courtes, un « Hmm… » ou un « alors » pour respirer, [inhales] avant la recommandation, [exhales] avant la chute, l'intention en tête entre crochets ([upbeat] d'ordinaire, [warmly] pour un cadeau) et [curious] devant la question finale, formulée en « Est-ce que… ». Rythme vif, comme une conseillère en boutique. Rien qui ne soit dans ta réponse écrite : mêmes noms, mêmes chiffres, mêmes prix.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { script: { ...str, description: "La note vocale, 280 caractères au plus, indications entre crochets comprises." } },
      required: ["script"],
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
  | { type: "suggest_replies"; replies: string[] }
  | { type: "speak"; script: string }
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
  knowledge: Knowledge,
  /** Le dernier message du visiteur : une réponse toute faite qui le répète est écartée. */
  userMessage = ""
): { actions: LumaAction[]; violations: Violation[] } {
  const said = userMessage.trim().toLowerCase();
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
      case "suggest_replies": {
        const replies = (Array.isArray(input.replies) ? input.replies : [])
          .filter((r): r is string => typeof r === "string")
          .map((r) => r.trim())
          .filter((r) => r.length > 0 && r.length <= MAX_REPLY_CHARS && r.toLowerCase() !== said)
          .slice(0, MAX_REPLIES);
        for (const r of replies) shown(r);
        if (replies.length) actions.push({ type: "suggest_replies", replies });
        break;
      }
      case "speak": {
        const script = typeof input.script === "string" ? input.script.trim().slice(0, SCRIPT_MAX_CHARS) : "";
        if (script) {
          // Les garde-fous lisent le script sans ses indications entre crochets.
          shown(stripTags(script));
          actions.push({ type: "speak", script });
        }
        break;
      }
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

/**
 * Les produits du catalogue que le texte nomme, dans l'ordre d'apparition. Sert
 * à garantir la fiche : la Maison veut la voir chaque fois qu'un Reflet est
 * nommé (Sandro, 11 septembre 2026), même si le modèle a oublié l'outil.
 */
export function productsNamedIn(text: string, knowledge: Knowledge): KnowledgeProduct[] {
  const lower = text.toLowerCase();
  return knowledge.products
    .map((product) => ({ product, at: lower.indexOf(product.name.toLowerCase()) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.product);
}

/* ------------------------------------------ réponses toutes faites de secours */

/** Les parfums d'origine de la collection (persona §2) : la réponse attendue à « que portez-vous ? ». */
const ORIGINS = ["Baccarat Rouge 540", "Bois Impérial", "Tuscan Leather", "Althaïr", "Erba Pura", "Oud Maracuja"];

/**
 * La porte de sortie de la liste des origines (Sandro, 11 septembre 2026) :
 * qui ne connaît aucun de ces parfums doit pouvoir le dire d'un clic, et Luma
 * change alors de porte — une matière, puis l'univers.
 */
export const ESCAPE_REPLY: Record<Locale, string> = {
  fr: "Aucun de ces parfums",
  en: "None of these",
  ar: "لا شيء من هذه",
};

/** Les matières signature de la collection, dans les mots du visiteur — même liste que LumaDoors. */
const MATERIALS: Record<Locale, string[]> = {
  fr: ["La vanille", "L'oud", "Le cuir", "La mangue", "Le safran", "Le musc", "La rose", "La praline"],
  en: ["Vanilla", "Oud", "Leather", "Mango", "Saffron", "Musk", "Rose", "Praline"],
  ar: ["الفانيليا", "العود", "الجلد", "المانجو", "الزعفران", "المسك", "الورد", "البرالين"],
};

const isOrigin = (r: string) => ORIGINS.some((o) => o.toLowerCase() === r.trim().toLowerCase());

/**
 * Quand le modèle a oublié suggest_replies deux fois, le visiteur a quand même
 * de quoi cliquer (Sandro, 11 septembre 2026 : « toujours proposer des
 * réponses toutes faites »). Trois jeux : après une recommandation, les suites
 * naturelles ; à la question « que portez-vous ? », les parfums d'origine ;
 * sinon, les univers de la section 6. Phrases EN/AR à faire valider.
 */
const FALLBACK_REPLIES: Record<Locale, { afterReco: string[]; universes: string[] }> = {
  fr: {
    afterReco: ["Parlez-moi de ses notes", "Je préfère le sentir d'abord"],
    universes: ["Chaud et gourmand", "Boisé et net", "Cuir et soir", "Frais et fruité", "Plutôt oud"],
  },
  en: {
    afterReco: ["Tell me about its notes", "I'd rather smell it first"],
    universes: ["Warm and gourmand", "Woody and clean", "Leather and evening", "Fresh and fruity", "Oud"],
  },
  ar: {
    afterReco: ["حدّثوني عن نفحاته", "أفضّل أن أشمّه أولاً"],
    universes: ["دافئ وحلو", "خشبي ونقي", "جلد ومساء", "منعش وفاكهي", "عود"],
  },
};

export function fallbackReplies(locale: Locale, text: string, hasRecommendation: boolean): string[] {
  const set = FALLBACK_REPLIES[locale];
  if (hasRecommendation) return set.afterReco;
  if (/matière|matieres|material|ingr[ée]dient|نفحة|مادة|مكوّن/i.test(text)) return MATERIALS[locale];
  if (/\b(porte|portez|wear|aimez|like|love)\b|ترتد|تحب|تضع/i.test(text)) return [...ORIGINS, ESCAPE_REPLY[locale]];
  return set.universes;
}

/**
 * Quand les réponses proposées sont des noms de Reflets — Luma demande de
 * choisir —, ce sont les six, tous, dans l'ordre du catalogue (Sandro,
 * 11 septembre 2026 : « quand c'est comme ça, mets les 6 parfums »). Le
 * modèle, tenu par « deux à quatre », s'arrêtait à quatre.
 */
export function normalizeReplies(actions: LumaAction[], knowledge: Knowledge): LumaAction[] {
  const names = knowledge.products.filter((p) => p.kind === "parfum").map((p) => p.name);
  const isName = (r: string) => names.some((n) => n.toLowerCase() === r.trim().toLowerCase());
  const escape = ESCAPE_REPLY[knowledge.locale];
  return actions.map((a) => {
    if (a.type !== "suggest_replies") return a;
    // Luma demande de choisir un Reflet : les six, tous.
    if (a.replies.filter(isName).length >= 2) return { ...a, replies: names };
    // Luma demande ce qu'on porte : les six origines, toutes, et la porte de sortie en dernier.
    if (a.replies.filter(isOrigin).length >= 3) return { ...a, replies: [...ORIGINS, escape] };
    return a;
  });
}

/**
 * Dernier recours avant le générique : quand la question de Luma oppose deux
 * options — « plutôt un boisé net, ou une gourmandise fruitée ? », « rather X,
 * or Y? », « X أم Y؟ » —, les réponses sont ces deux options. Déterministe,
 * donc toujours en rapport avec la question (Sandro, 11 septembre 2026).
 */
export function repliesFromQuestion(text: string): string[] {
  const last = text.split(/\n+/).filter(Boolean).pop() ?? "";
  const question = last.match(/([^.!?؟]*[?؟])\s*$/)?.[1]?.trim() ?? "";
  if (!question) return [];
  const parts = question.replace(/[?؟]\s*$/, "").split(/\s*,?\s+(?:ou|or)\s+|\s+أم\s+/i);
  if (parts.length !== 2) return [];
  const marker = /(?:plutôt|plutot|rather|prefer|préférez|préfère|toward|towards|vers)\s+/i;
  let [first, second] = parts.map((x) => x.trim());
  // Le début de la question précède la première option : on coupe au marqueur.
  const m = first.match(marker);
  if (!m) return [];
  first = first.slice((m.index ?? 0) + m[0].length);
  const tidy = (x: string) =>
    x
      .replace(/^(?:sur|pour|vers|de|d'|to|for|on)\s+/i, "")
      .trim()
      .replace(/^[a-zà-ÿ]/, (c) => c.toUpperCase());
  const options = [tidy(first), tidy(second)].filter((x) => x.length >= 3 && x.length <= 48);
  return options.length === 2 ? options : [];
}
