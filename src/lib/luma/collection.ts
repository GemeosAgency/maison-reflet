/**
 * Ce que Luma sait de la collection — transcription du document persona.
 *
 * ⚠️ RIEN N'EST RÉDIGÉ ICI. Chaque chaîne est reprise telle quelle des
 * sections 5 et 6 de `luma-persona-et-voix.md`, qui fait autorité. Ce fichier
 * n'est qu'un transport : il met le contenu de Sandro dans une forme que le
 * prompt peut assembler.
 *
 * Pourquoi ce n'est pas lu depuis Sanity, contrairement à ce qu'annonce le
 * document persona : l'audit du 10 septembre 2026 montre que les champs
 * concernés n'y sont pas exploitables — `specificTwist` n'existe que sur Bois
 * Alert et contient un texte anglais parlant d'une rose de Taïf absente de ses
 * notes ; `familles` n'est rempli que sur Bois Alert ; les blocs éditoriaux des
 * cinq autres racontent encore l'ancienne collection. Luma y puiserait des
 * histoires qui ne correspondent pas aux parfums.
 *
 * La bascule est déjà prévue : `knowledge.ts` PRÉFÈRE toujours Sanity quand le
 * champ y est rempli et retombe ici sinon. Le jour où le chantier CMS
 * (section 12 du persona) est fait, ce fichier s'efface de lui-même, sans
 * modification de code. Les notes, elles, sont déjà lues en direct — elles
 * sont complètes et exactes pour les six.
 */

/** Correspondances de la section 6 du persona, dans son ordre. */
export type MatchRule = {
  /** « Signal du visiteur », colonne 1. */
  signal: string;
  /** Handle Shopify du parfum ou coffret recommandé. */
  recommend: string;
  /** Handle de l'alternative. */
  alternative: string;
  /** Nuance donnée par Sandro entre parenthèses, quand il y en a une. */
  nuance?: string;
};

export type RefletKnowledge = {
  handle: string;
  /** Nom d'affichage, identique dans les trois langues. */
  name: string;
  /** « Twist de » — la référence assumée, section 2 du persona. */
  twistOf: string;
  /** « Ce que Luma en retient » — sa lecture du parfum, en une ou deux phrases. */
  essence: string;
  bestSeller?: boolean;
};

/**
 * Les six Reflets, section 5 du persona.
 *
 * `twistOf` porte la référence complète telle qu'écrite par Sandro, maison
 * comprise : c'est ce que Luma peut nommer. Les notes ne sont PAS ici, elles
 * viennent de Sanity où elles sont justes.
 */
export const REFLETS: RefletKnowledge[] = [
  {
    handle: "bois-alert",
    name: "Bois Alert",
    twistOf:
      "Bois Impérial, Essential Parfums, enrichi des facettes safran-jasmin-mousse de Baccarat Rouge 540",
    essence:
      "Le boisé affirmé, aérien, celui qu'on recommande quand on ne sait pas. Le feu que les deux rives reconnaissent.",
    bestSeller: true,
  },
  {
    handle: "new-oud",
    name: "New Oud",
    twistOf:
      "Oud Maracuja, Maison Crivelli, avec le santal poudré et la rose de Carbone (Balmain) et le floral blanc de Valaya (Parfums de Marly)",
    essence:
      "L'oud moderne, fruité en ouverture, floral au cœur. Pour qui aime l'oud sans le vouloir médicinal.",
  },
  {
    handle: "melting-mango",
    name: "Melting Mango",
    twistOf: "Baccarat Rouge 540, MFK, avec une surdose d'accord mangue",
    essence:
      "La signature la plus reconnaissable du marché, avec une ouverture juteuse que l'original n'a pas.",
  },
  {
    handle: "ultra-cuir",
    name: "Ultra Cuir",
    twistOf: "Tuscan Leather, Tom Ford, framboise plus lumineuse, trio de safrans, facette iris",
    essence:
      "Le cuir, assumé, adouci par l'iris. Le plus masculin dans la perception, le plus « soir ».",
  },
  {
    handle: "minuit-bourbon",
    name: "Minuit Bourbon",
    twistOf: "Althaïr, Parfums de Marly, avec un accord cuir",
    essence: "La gourmandise tonka-vanille tenue par du cuir. Chaud, enveloppant, addictif.",
  },
  {
    handle: "fifth-season",
    name: "Fifth Season",
    twistOf:
      "Erba Pura, Xerjoff, avec la fougère de Bleu de Chanel, les facettes de Baccarat Rouge 540 et la douceur lactée de Bianco Latte",
    essence: "Le fruité solaire rendu plus fondu, plus portable. Le plus frais de la collection.",
  },
];

/**
 * Les deux coffrets. Le Coffret découverte est « la réponse par défaut au
 * doute » (section 6) : c'est l'outil central de Luma, pas un produit parmi
 * d'autres.
 */
export const COFFRETS = [
  {
    handle: "sample-box",
    name: "Coffret découverte",
    nameEn: "Discovery box",
    nameAr: "علبة الاكتشاف",
    essence: "6 × 2 ml. L'outil central pour les indécis.",
  },
  {
    handle: "all-6-perfums-box",
    name: "Les 6 Reflets",
    nameEn: "The 6 Reflets",
    nameAr: "الانعكاسات الستة",
    essence: "6 × 75 ml. La collection complète, pour l'ancrage prix et le grand cadeau.",
  },
];

/** Grille de correspondance, section 6 du persona, dans son ordre exact. */
export const MATCH_RULES: MatchRule[] = [
  {
    signal: "Porte ou aime Baccarat Rouge 540 et ses héritiers",
    recommend: "melting-mango",
    alternative: "bois-alert",
    nuance: "même famille safran-ambrée, plus boisée",
  },
  {
    signal: "Aime le boisé, veut de la présence sans sucre",
    recommend: "bois-alert",
    alternative: "ultra-cuir",
  },
  {
    signal: "Aime le cuir, Tuscan Leather, Ombre Leather, les soirs",
    recommend: "ultra-cuir",
    alternative: "bois-alert",
  },
  {
    signal: "Aime le gourmand, la vanille, Althaïr, Layton",
    recommend: "minuit-bourbon",
    alternative: "fifth-season",
  },
  {
    signal: "Aime le frais, le fruité, Erba Pura, Bleu de Chanel",
    recommend: "fifth-season",
    alternative: "melting-mango",
  },
  {
    signal: "Aime l'oud, en veut un moderne",
    recommend: "new-oud",
    alternative: "ultra-cuir",
  },
  {
    signal: "Homme qui veut de la puissance",
    recommend: "ultra-cuir",
    alternative: "bois-alert",
  },
  {
    signal: "Femme qui veut du lumineux",
    recommend: "fifth-season",
    alternative: "melting-mango",
  },
  {
    signal: "Ne sait pas, veut essayer",
    recommend: "sample-box",
    alternative: "bois-alert",
    nuance: "le best-seller, choix sûr",
  },
  {
    signal: "Cadeau sans connaître les goûts",
    recommend: "sample-box",
    alternative: "bois-alert",
  },
  {
    signal: "Grand cadeau, Eid, mariage, connaisseur",
    recommend: "all-6-perfums-box",
    alternative: "sample-box",
    nuance: "pour choisir, puis le 75 ml",
  },
];

/**
 * Les trois questions du diagnostic, section 6. « Dans l'ordre que le contexte
 * impose », et sautées si le visiteur donne assez d'éléments spontanément.
 */
export const DIAGNOSTIC_QUESTIONS = [
  "Pour vous ou pour offrir ?",
  "Ce que vous portez ou aimez aujourd'hui",
  "L'univers si rien ne sort : chaud et gourmand, boisé et net, cuir et soir, frais et fruité, oud",
];

/** Les cinq univers de la troisième question, pour les réponses tapables. */
export const UNIVERSES = [
  "chaud et gourmand",
  "boisé et net",
  "cuir et soir",
  "frais et fruité",
  "oud",
];

/**
 * Réassurances, telles qu'affichées sur le site (section 5). Luma peut les
 * citer, « mais pas les détailler au-delà de ce que le site dit » — d'où des
 * formules nues, sans chiffre ni condition.
 */
export const REASSURANCES = [
  "livraison offerte",
  "paiement sécurisé",
  "service client réactif",
  "échantillons offerts",
  "cadeau pour la première commande",
];

/** Seule porte de sortie que Luma propose (section 5). */
export const CONTACT_EMAIL = "contact@maisonreflet.com";

const BY_HANDLE = new Map<string, RefletKnowledge | (typeof COFFRETS)[number]>([
  ...REFLETS.map((r) => [r.handle, r] as const),
  ...COFFRETS.map((c) => [c.handle, c] as const),
]);

export function knownProduct(handle: string) {
  return BY_HANDLE.get(handle);
}

/** Handles que Luma est autorisée à nommer. Tout le reste n'existe pas pour elle. */
export const ALLOWED_HANDLES = [...REFLETS.map((r) => r.handle), ...COFFRETS.map((c) => c.handle)];
