/**
 * Prédicats de catalogue, sans dépendance à l'environnement.
 *
 * Ils vivaient dans shopify.ts, qui lit `import.meta.env` au chargement et
 * ne peut donc pas être importé hors d'Astro. Luma (src/lib/luma/knowledge.ts)
 * doit rester testable dans Node avec des fixtures : les prédicats sont ici, et
 * shopify.ts les ré-exporte pour ses appelants historiques.
 */

import type { ShopifyProduct } from "./shopify";

// Mots-clés de la catégorie Shopify (taxonomie standard) qui signalent un
// coffret/set, par opposition à un parfum vendu à l'unité (ex : « Perfume
// Sample & Discovery Sets ») — utile quand « Type de produit » n'est pas rempli.
const COFFRET_CATEGORY_KEYWORDS = ["sample", "discovery", "gift set", "coffret", "set"];

/**
 * Un coffret (set multi-parfums) n'est pas un parfum classique : distingué soit
 * par le « Type de produit » Shopify = "Coffret", soit par sa catégorie.
 */
export function isCoffret(product: Pick<ShopifyProduct, "productType" | "category">) {
  if (product.productType?.trim().toLowerCase() === "coffret") return true;
  const categoryName = product.category?.name?.toLowerCase() ?? "";
  return COFFRET_CATEGORY_KEYWORDS.some((k) => categoryName.includes(k));
}

// Mots-clés identifiant une variante « échantillon » (offerte dans le panier).
// Ces variantes ne doivent JAMAIS servir de variante d'affichage : le « à partir
// de » et les cartes produit tomberaient au prix de l'échantillon. Doit rester
// cohérent avec la détection du panier (CartDrawer).
const SAMPLE_VARIANT_KEYWORDS = ["sample", "échantillon", "echantillon", "2 ml", "2ml"];

/** Vrai si le titre de variante correspond à un échantillon (ex : "2 ml", "Échantillon"). */
export function isSampleVariantTitle(title: string): boolean {
  const l = title.toLowerCase();
  return SAMPLE_VARIANT_KEYWORDS.some((k) => l.includes(k));
}
