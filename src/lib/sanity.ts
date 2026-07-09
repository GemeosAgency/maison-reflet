/**
 * Client Sanity
 * Documentation : https://www.sanity.io/docs/js-client
 *
 * Variables d'env requises (voir .env.example) :
 * - SANITY_PROJECT_ID
 * - SANITY_DATASET       ex: production
 * - SANITY_API_VERSION   ex: 2025-01-01
 * - SANITY_READ_TOKEN    optionnel, requis seulement pour le contenu en draft/preview
 */

import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";

// Type minimal pour une référence d'image Sanity (évite une dépendance
// de types externe fragile — suffisant pour urlForImage()).
type SanityImageSource =
  | string
  | { asset?: { _ref?: string; _id?: string; url?: string }; _ref?: string; _id?: string };

export const sanityClient = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID,
  dataset: import.meta.env.SANITY_DATASET || "production",
  apiVersion: import.meta.env.SANITY_API_VERSION || "2025-01-01",
  token: import.meta.env.SANITY_READ_TOKEN, // laisser vide en prod si dataset public
  // Le CDN ne sert que du contenu public : dès qu'un token est présent
  // (dataset privé ou preview de drafts), il faut interroger l'API directe.
  useCdn: !import.meta.env.SANITY_READ_TOKEN,
});

const builder = createImageUrlBuilder(sanityClient);

/** Génère une URL d'image optimisée à partir d'une référence d'image Sanity */
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

// ---------- Types de contenu ----------

// Tous les champs éditoriaux sont optionnels : seul shopifyHandle est requis
// dans le Studio, une fiche peut donc exister partiellement remplie.
export type SanityParfumContent = {
  _id: string;
  shopifyHandle: string; // fait le lien avec le produit Shopify du même handle
  histoire?: string; // storytelling long-form du parfum
  notesOlfactives?: {
    tete?: string[];
    coeur?: string[];
    fond?: string[];
  };
  inspirationCulturelle?: string; // ancrage franco-arabe du parfum
  imagesEditoriales?: SanityImageSource[];
};

export type SanityPage = {
  _id: string;
  title: string;
  slug: string;
  content: unknown; // Portable Text — voir Sanity Studio schema
};

// ---------- Queries (GROQ) ----------

/** Récupère le contenu éditorial d'un parfum via son handle Shopify */
export async function getParfumContent(shopifyHandle: string) {
  return sanityClient.fetch<SanityParfumContent | null>(
    `*[_type == "parfum" && shopifyHandle == $handle][0]{
      _id,
      shopifyHandle,
      histoire,
      notesOlfactives,
      inspirationCulturelle,
      imagesEditoriales
    }`,
    { handle: shopifyHandle }
  );
}

/** Récupère une page de contenu (à propos, maison, etc.) par son slug */
export async function getPageBySlug(slug: string) {
  return sanityClient.fetch<SanityPage | null>(
    `*[_type == "page" && slug.current == $slug][0]{
      _id,
      title,
      "slug": slug.current,
      content
    }`,
    { slug }
  );
}
