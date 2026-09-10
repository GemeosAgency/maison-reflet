/**
 * Connaissance de Luma sur données réelles, pour les scripts Node.
 *
 * knowledge-live.ts fait la même chose dans le site, mais importe shopify.ts et
 * sanity.ts, qui lisent import.meta.env au chargement et ne peuvent pas tourner
 * dans Node. Ce module refait les deux lectures avec process.env — mêmes
 * requêtes, mêmes champs — et assemble avec le VRAI buildKnowledge.
 *
 * Prérequis : le hook de résolution .ts doit être enregistré par l'appelant
 * (voir ts-resolve-hooks.mjs), et .env chargé dans process.env.
 */

import { createClient } from "@sanity/client";

const { buildKnowledge } = await import("../../src/lib/luma/knowledge.ts");
const { getCountry } = await import("../../src/lib/markets.ts");

const env = process.env;

const sanity = createClient({
  projectId: env.SANITY_PROJECT_ID,
  dataset: env.SANITY_DATASET || "production",
  apiVersion: "2025-01-01",
  token: env.SANITY_READ_TOKEN,
  useCdn: false,
  perspective: "published",
});

// Même projection que getLumaParfums (sanity.ts).
function lumaParfums(l) {
  const names = `[]->{ "nom": coalesce(nom.${l}, nom.fr) }.nom`;
  return sanity.fetch(`*[_type == "parfum" && defined(shopifyHandle)]{
    shopifyHandle, inspiredBy, bestSeller,
    "familles": coalesce(familles.${l}, familles.fr),
    "description": pt::text(coalesce(description.${l}, description.fr)),
    "notes": {
      "tete": coalesce(notesTete${names}, []),
      "coeur": coalesce(notesCoeur${names}, []),
      "fond": coalesce(notesFond${names}, [])
    }
  }`);
}

const endpoint = `https://${env.PUBLIC_SHOPIFY_STORE_DOMAIN}/api/${env.PUBLIC_SHOPIFY_API_VERSION || "2025-10"}/graphql.json`;

async function products(country, language) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: `query LumaProducts($first: Int!, $country: CountryCode, $language: LanguageCode)
        @inContext(country: $country, language: $language) {
        products(first: $first) { nodes { id handle title productType category { id name }
          variants(first: 20) { nodes { id title availableForSale price { amount currencyCode } } } } } }`,
      variables: { first: 50, country, language },
    }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(", "));
  return json.data.products.nodes;
}

export async function liveKnowledge(country, locale) {
  const [prods, docs] = await Promise.all([products(country, locale.toUpperCase()), lumaParfums(locale)]);
  return buildKnowledge({ products: prods, parfums: docs, country: getCountry(country), locale });
}
