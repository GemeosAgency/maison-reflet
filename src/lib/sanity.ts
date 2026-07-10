/**
 * Client Sanity + requêtes de contenu (localisées fr/ar/en).
 * Seul point qui parle à Sanity (convention projet).
 */
import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import { locales, defaultLocale, type Locale } from "../i18n";

type SanityImageSource =
  | string
  | { asset?: { _ref?: string; _id?: string; url?: string }; _ref?: string; _id?: string };

export const sanityClient = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID,
  dataset: import.meta.env.SANITY_DATASET || "production",
  apiVersion: import.meta.env.SANITY_API_VERSION || "2025-01-01",
  token: import.meta.env.SANITY_READ_TOKEN,
  useCdn: !import.meta.env.SANITY_READ_TOKEN,
});

// ---------- Écriture (liste d'attente) ----------
let _writeClient: ReturnType<typeof createClient> | null = null;
function getWriteClient() {
  const token =
    import.meta.env.SANITY_WRITE_TOKEN ||
    (typeof process !== "undefined" ? process.env.SANITY_WRITE_TOKEN : undefined);
  if (!token) throw new Error("SANITY_WRITE_TOKEN manquant (token d'écriture Sanity)");
  if (!_writeClient) {
    _writeClient = createClient({
      projectId: import.meta.env.SANITY_PROJECT_ID,
      dataset: import.meta.env.SANITY_DATASET || "production",
      apiVersion: import.meta.env.SANITY_API_VERSION || "2025-01-01",
      token,
      useCdn: false,
    });
  }
  return _writeClient;
}

/** Ajoute un email à la liste d'attente. _id déterministe => pas de doublon. */
export async function createSubscriber(email: string, source = "teaser") {
  const clean = email.trim().toLowerCase();
  const safe = clean.replace(/[^a-z0-9]/g, "-");
  return getWriteClient().createIfNotExists({
    _id: `subscriber-${safe}`,
    _type: "subscriber",
    email: clean,
    createdAt: new Date().toISOString(),
    source,
  });
}

const builder = createImageUrlBuilder(sanityClient);
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

// ---------- Contenu localisé ----------

// Sécurise l'interpolation de la langue dans les requêtes GROQ.
function safeLocale(locale: Locale): Locale {
  return locales.includes(locale) ? locale : defaultLocale;
}

export type NoteCard = {
  nom: string | null;
  famille: string | null;
  histoire: string | null;
  image: unknown | null;
};

export type BlocEditorial = {
  titre: string | null;
  texte: string | null;
  image: unknown | null;
  imageAGauche: boolean | null;
};

export type ParfumContent = {
  accroche: string | null;
  inspiredBy: string | null;
  blocs: BlocEditorial[];
  familleOlfactive: string | null;
  parfumeur: string | null;
  couleurSignature: string | null;
  notes: { tete: NoteCard[]; coeur: NoteCard[]; fond: NoteCard[] };
  images: { _key: string; asset: unknown; alt: string | null }[];
};

/** Contenu éditorial d'un parfum dans une langue donnée (repli FR). */
export async function getParfumContent(
  handle: string,
  locale: Locale
): Promise<ParfumContent | null> {
  const l = safeLocale(locale);
  const noteCards = `[]->{ "nom": coalesce(nom.${l}, nom.fr), famille, "histoire": coalesce(histoire.${l}, histoire.fr), image }`;
  const query = `*[_type == "parfum" && shopifyHandle == $handle][0]{
    "accroche": coalesce(accroche.${l}, accroche.fr),
    inspiredBy,
    "blocs": blocs[]{
      "titre": coalesce(titre.${l}, titre.fr),
      "texte": coalesce(texte.${l}, texte.fr),
      image,
      imageAGauche
    },
    familleOlfactive,
    parfumeur,
    couleurSignature,
    "notes": {
      "tete": notesTete${noteCards},
      "coeur": notesCoeur${noteCards},
      "fond": notesFond${noteCards}
    },
    "images": imagesEditoriales[]{ _key, asset, "alt": coalesce(alt.${l}, alt.fr) }
  }`;
  return sanityClient.fetch(query, { handle });
}

export type PageContent = { title: string | null; content: unknown[] | null };

/** Page de contenu libre (La Maison…) dans une langue donnée (repli FR). */
export async function getPageBySlug(slug: string, locale: Locale): Promise<PageContent | null> {
  const l = safeLocale(locale);
  const query = `*[_type == "page" && slug.current == $slug][0]{
    "title": coalesce(title.${l}, title.fr),
    "content": coalesce(content.${l}, content.fr)
  }`;
  return sanityClient.fetch(query, { slug });
}

/** Map handle -> "inspiré de" pour tous les parfums (cartes recommandées). */
export async function getInspiredByMap(): Promise<Record<string, string>> {
  const rows = await sanityClient.fetch<{ shopifyHandle: string; inspiredBy: string }[]>(
    `*[_type == "parfum" && defined(inspiredBy)]{ shopifyHandle, inspiredBy }`
  );
  return Object.fromEntries(rows.map((r) => [r.shopifyHandle, r.inspiredBy]));
}

export type SiteSettings = {
  brandName: string | null;
  baseline: string | null;
  about: string | null;
};

/** Réglages globaux de la marque (localisés). */
export async function getSettings(locale: Locale): Promise<SiteSettings | null> {
  const l = safeLocale(locale);
  const query = `*[_type == "settings"][0]{
    brandName,
    "baseline": coalesce(baseline.${l}, baseline.fr),
    "about": coalesce(about.${l}, about.fr)
  }`;
  return sanityClient.fetch(query);
}
