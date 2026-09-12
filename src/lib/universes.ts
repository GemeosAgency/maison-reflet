/**
 * Les cinq univers olfactifs de la Maison — le vocabulaire de Luma (persona,
 * section 6 : « chaud et gourmand, boisé et net, cuir et soir, frais et
 * fruité, oud »), repris tel quel dans le menu de navigation sous le nom de
 * chaque Reflet (décision Sandro, 11 septembre 2026 : l'univers plutôt que
 * les familles Sanity, incomplètes et non traduites).
 *
 * L'appartenance suit la grille de correspondance de Luma (MATCH_RULES dans
 * lib/luma/collection.ts) : Melting Mango y est l'alternative du « frais et
 * fruité », Fifth Season son premier choix — d'où le même univers pour les
 * deux. Les réponses toutes faites de Luma (lib/luma/tools.ts) gardent leur
 * propre formulation (« Plutôt oud »), pensée pour être cliquée.
 */
import type { Locale } from "../i18n";

export type UniverseKey = "gourmand" | "boise" | "cuir" | "frais" | "oud";

export const UNIVERSE_LABELS: Record<UniverseKey, Record<Locale, string>> = {
  gourmand: { fr: "Chaud et gourmand", en: "Warm and gourmand", ar: "دافئ وحلو" },
  boise: { fr: "Boisé et net", en: "Woody and clean", ar: "خشبي ونقي" },
  cuir: { fr: "Cuir et soir", en: "Leather and evening", ar: "جلد ومساء" },
  frais: { fr: "Frais et fruité", en: "Fresh and fruity", ar: "منعش وفاكهي" },
  // « Oud » seul était trop court à côté des autres (Sandro) : la rose de Taïf,
  // au cœur de New Oud, dit le moderne et parle au Golfe — même patron « X et Y ».
  oud: { fr: "Oud et rose", en: "Oud and rose", ar: "عود وورد" },
};

/** Handle Shopify → univers. Un Reflet absent d'ici n'a simplement pas de ligne d'univers. */
export const REFLET_UNIVERSE: Record<string, UniverseKey> = {
  "bois-alert": "boise",
  "new-oud": "oud",
  "melting-mango": "frais",
  "ultra-cuir": "cuir",
  "minuit-bourbon": "gourmand",
  "fifth-season": "frais",
};

export function universeLabel(handle: string, locale: Locale): string | null {
  const key = REFLET_UNIVERSE[handle];
  return key ? UNIVERSE_LABELS[key][locale] : null;
}
