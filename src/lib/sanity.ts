/**
 * Client Sanity + requêtes de contenu (localisées fr/ar/en).
 * Seul point qui parle à Sanity (convention projet).
 */
import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import { toHTML, type PortableTextComponents } from "@portabletext/to-html";
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
  /*
   * OBLIGATOIRE tant qu'on lit avec un token : sans perspective explicite, une
   * requête renvoie le brouillon ET le document publié. Les projections en
   * `[0]` (getParfumContent, getPageBySlug…) attrapaient alors le brouillon —
   * "drafts.xxx" trie avant "xxx" — donc tout contenu non publié partait en
   * production. `published` restaure le comportement attendu d'un site public.
   * Un mode preview devra passer son propre client en perspective "drafts".
   */
  perspective: "published",
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

/** Rendu HTML d'un champ "localeBlock" (Portable Text : paragraphes, listes, liens, images). */
const richTextComponents: Partial<PortableTextComponents> = {
  types: {
    image: ({ value }) =>
      `<img src="${urlForImage(value as SanityImageSource).width(1200).url()}" alt="" loading="lazy" />`,
  },
};
export function richTextToHtml(blocks: unknown[] | null | undefined): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  return toHTML(blocks as Parameters<typeof toHTML>[0], { components: richTextComponents });
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

export type ReassuranceItem = {
  icone: unknown;
  texte: string | null;
};

export type FaqItem = {
  question: string | null;
  reponse: unknown[] | null;
};

export type ParfumContent = {
  accroche: string | null;
  description: unknown[] | null;
  inspiredBy: string | null;
  specificTwist: string | null;
  perfumerWord: string | null;
  perfumerPhoto: unknown | null;
  imagePyramide: unknown | null;
  blocs: BlocEditorial[];
  familleOlfactive: string | null;
  familles: string | null;
  intensite: number | null;
  sillage: number | null;
  bestSeller: boolean | null;
  parfumeur: string | null;
  couleurSignature: string | null;
  notes: { tete: NoteCard[]; coeur: NoteCard[]; fond: NoteCard[] };
  imageTwist: unknown | null;
  images: { _key: string; asset: unknown; alt: string | null }[];
  reassurances: ReassuranceItem[];
  reassurancesCta: ReassuranceItem[];
  ingredients: (string | null)[];
  faqs: FaqItem[];
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
    "description": coalesce(description.${l}, description.fr),
    inspiredBy,
    "specificTwist": coalesce(specificTwist.${l}, specificTwist.fr),
    "perfumerWord": coalesce(perfumerWord.${l}, perfumerWord.fr),
    perfumerPhoto,
    imagePyramide,
    "blocs": blocs[]{
      "titre": coalesce(titre.${l}, titre.fr),
      "texte": coalesce(texte.${l}, texte.fr),
      image,
      imageAGauche
    },
    familleOlfactive,
    "familles": coalesce(familles.${l}, familles.fr),
    intensite,
    sillage,
    bestSeller,
    parfumeur,
    couleurSignature,
    "notes": {
      "tete": notesTete${noteCards},
      "coeur": notesCoeur${noteCards},
      "fond": notesFond${noteCards}
    },
    imageTwist,
    "images": imagesEditoriales[]{ _key, asset, "alt": coalesce(alt.${l}, alt.fr) },
    "reassurances": reassurances[]->{
      icone,
      "texte": coalesce(texte.${l}, texte.fr)
    },
    "reassurancesCta": reassurancesCta[]->{
      icone,
      "texte": coalesce(texte.${l}, texte.fr)
    },
    "ingredients": ingredients[]->{ "nom": coalesce(nom.${l}, nom.fr) }.nom,
    "faqs": faqs[]->{
      "question": coalesce(question.${l}, question.fr),
      "reponse": coalesce(reponse.${l}, reponse.fr)
    }
  }`;
  return sanityClient.fetch(query, { handle });
}

export type PageContent = { title: string | null; content: unknown[] | null; faqs: FaqItem[] };

/** Page de contenu libre (La Maison…) dans une langue donnée (repli FR). */
export async function getPageBySlug(slug: string, locale: Locale): Promise<PageContent | null> {
  const l = safeLocale(locale);
  const query = `*[_type == "page" && slug.current == $slug][0]{
    "title": coalesce(title.${l}, title.fr),
    "content": coalesce(content.${l}, content.fr),
    "faqs": faqs[]->{
      "question": coalesce(question.${l}, question.fr),
      "reponse": coalesce(reponse.${l}, reponse.fr)
    }
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

/** Map handle -> badge "best seller" (cartes produit). */
export async function getBestSellerMap(): Promise<Record<string, boolean>> {
  const rows = await sanityClient.fetch<{ shopifyHandle: string }[]>(
    `*[_type == "parfum" && bestSeller == true]{ shopifyHandle }`
  );
  return Object.fromEntries(rows.map((r) => [r.shopifyHandle, true]));
}

export type RecoImages = { main: unknown | null; hover: unknown | null };

/** Map handle -> images dédiées "Vous aimerez aussi" (par défaut + au survol) pour tous les parfums qui en ont. */
export async function getRecoImages(): Promise<Record<string, RecoImages>> {
  const rows = await sanityClient.fetch<
    { shopifyHandle: string; imageRecommandation: unknown; imageRecommandationHover: unknown }[]
  >(
    `*[_type == "parfum" && (defined(imageRecommandation) || defined(imageRecommandationHover))]{
      shopifyHandle, imageRecommandation, imageRecommandationHover
    }`
  );
  return Object.fromEntries(
    rows.map((r) => [
      r.shopifyHandle,
      { main: r.imageRecommandation ?? null, hover: r.imageRecommandationHover ?? null },
    ])
  );
}

export type CoffretContent = {
  shopifyHandle: string;
  titre: string | null;
  description: string | null;
  image: unknown | null;
  faqs?: FaqItem[];
};

/** Coffrets (sets multi-parfums) dans une langue donnée (repli FR), triés par "ordre". */
export async function getCoffrets(locale: Locale): Promise<CoffretContent[]> {
  const l = safeLocale(locale);
  const query = `*[_type == "coffret"] | order(ordre asc){
    shopifyHandle,
    "titre": coalesce(titre.${l}, titre.fr),
    "description": coalesce(description.${l}, description.fr),
    image
  }`;
  return sanityClient.fetch(query);
}

/** Contenu d'un coffret par son handle Shopify, dans une langue donnée (repli FR). */
export async function getCoffretByHandle(handle: string, locale: Locale): Promise<CoffretContent | null> {
  const l = safeLocale(locale);
  const query = `*[_type == "coffret" && shopifyHandle == $handle][0]{
    shopifyHandle,
    "titre": coalesce(titre.${l}, titre.fr),
    "description": coalesce(description.${l}, description.fr),
    image,
    "faqs": faqs[]->{
      "question": coalesce(question.${l}, question.fr),
      "reponse": coalesce(reponse.${l}, reponse.fr)
    }
  }`;
  return sanityClient.fetch(query, { handle });
}

/** Bibliothèque complète des réassurances (livraison, paiement…), dans l'ordre de création. */
export async function getReassurances(locale: Locale): Promise<ReassuranceItem[]> {
  const l = safeLocale(locale);
  const query = `*[_type == "reassurance"] | order(_createdAt asc){
    icone,
    "texte": coalesce(texte.${l}, texte.fr)
  }`;
  return sanityClient.fetch(query);
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
