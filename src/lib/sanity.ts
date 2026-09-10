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

const builder = createImageUrlBuilder(sanityClient);
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

/**
 * Largeur native d'une image, lue directement dans son `_ref` Sanity
 * (`image-<hash>-958x1120-jpg`) — évite d'aller chercher
 * `asset->metadata.dimensions` dans chaque requête.
 */
function nativeWidth(source: SanityImageSource): number | null {
  const ref =
    typeof source === "string"
      ? source
      : ((source as { asset?: { _ref?: string } }).asset?._ref ??
        (source as { _ref?: string })._ref ??
        null);
  const match = typeof ref === "string" ? ref.match(/-(\d+)x(\d+)-[a-z]+$/) : null;
  return match ? Number(match[1]) : null;
}

export type ResponsiveImage = { src: string; srcset: string };

/**
 * Prépare une image Sanity pour un affichage net sur écran haute densité.
 *
 * Demander une seule URL à la largeur CSS de l'emplacement donne une image
 * floue sur un écran 2x (le cas de la majorité des mobiles et des portables) :
 * il faut deux fois plus de pixels que la taille d'affichage. On génère donc
 * plusieurs largeurs et on laisse le navigateur choisir selon la densité et le
 * viewport — c'est le rôle de srcset + sizes (le `sizes` est fourni par le
 * composant appelant, qui seul connaît la largeur de son emplacement).
 *
 * Les largeurs sont PLAFONNÉES à la taille native de l'original : au-delà,
 * Sanity agrandit l'image, ce qui alourdit le transfert sans gagner en
 * netteté. `auto("format")` sert du WebP/AVIF aux navigateurs compatibles,
 * ce qui compense le surcoût du passage en 2x.
 *
 * @param aspect ratio largeur/hauteur du cadre (ex. 3/4) — recadrage centré
 *   sur le hotspot défini dans le Studio. Omis = proportions d'origine.
 */
export function responsiveImage(
  source: SanityImageSource,
  options: { widths: number[]; aspect?: number; quality?: number }
): ResponsiveImage {
  const { widths, aspect, quality = 82 } = options;
  const native = nativeWidth(source);

  /*
   * On écarte les largeurs supérieures à l'original (Sanity agrandirait sans
   * gain de netteté), MAIS on ajoute la largeur native elle-même : sans ça, une
   * source de 958 px plafonnerait au palier 720 et resterait floue sur un
   * écran 2x, alors que ses 958 px réels suffisaient.
   */
  const capped = native ? widths.filter((w) => w <= native) : widths;
  const usable = native
    ? [...capped, ...(capped[capped.length - 1] === native ? [] : [native])]
    : capped;

  const url = (w: number) => {
    let b = urlForImage(source).width(w).auto("format").quality(quality);
    if (aspect) b = b.height(Math.round(w / aspect)).fit("crop");
    return b.url();
  };

  return {
    src: url(usable[usable.length - 1]),
    srcset: usable.map((w) => `${url(w)} ${w}w`).join(", "),
  };
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

/** Bloc SEO d'un document (titre/description surchargés + image de partage). */
export type SeoFields = {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: unknown | null;
};

/** Projection GROQ du bloc `seo`, localisée — à interpoler dans une requête. */
const seoProjection = (l: Locale) => `"seo": seo{
    "metaTitle": coalesce(metaTitle.${l}, metaTitle.fr),
    "metaDescription": coalesce(metaDescription.${l}, metaDescription.fr),
    ogImage
  }`;

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
  seo: SeoFields | null;
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
    },
    ${seoProjection(l)}
  }`;
  return sanityClient.fetch(query, { handle });
}

export type PageContent = {
  title: string | null;
  content: unknown[] | null;
  faqs: FaqItem[];
  seo: SeoFields | null;
};

/** Page de contenu libre (La Maison…) dans une langue donnée (repli FR). */
export async function getPageBySlug(slug: string, locale: Locale): Promise<PageContent | null> {
  const l = safeLocale(locale);
  const query = `*[_type == "page" && slug.current == $slug][0]{
    "title": coalesce(title.${l}, title.fr),
    "content": coalesce(content.${l}, content.fr),
    "faqs": faqs[]->{
      "question": coalesce(question.${l}, question.fr),
      "reponse": coalesce(reponse.${l}, reponse.fr)
    },
    ${seoProjection(l)}
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
  /** Ligne entre filets sous la description, ex. « 6 x 2 ML individual samples ». */
  contenance?: string | null;
  image: unknown | null;
  perfumerWord?: string | null;
  perfumerPhoto?: unknown | null;
  faqs?: FaqItem[];
  /** Parfums du coffret, avec leurs notes — alimente les onglets Scent Notes. */
  parfums?: CoffretParfum[];
};

/** Un parfum inclus dans un coffret, réduit à ce que la page coffret affiche. */
export type CoffretParfum = {
  shopifyHandle: string;
  /** Repère du Studio — le nom affiché vient de Shopify, c'est un repli. */
  nom: string | null;
  notes: { tete: CoffretNote[]; coeur: CoffretNote[]; fond: CoffretNote[] };
};

export type CoffretNote = { nom: string | null; image: unknown | null };

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

/**
 * Projection d'un niveau de notes pour un parfum de coffret : seulement le nom
 * et la photo de matière, c'est tout ce que le triptyque Scent Notes affiche.
 */
const coffretNoteCards = (l: string) => `[]->{ "nom": coalesce(nom.${l}, nom.fr), image }`;

/** Contenu d'un coffret par son handle Shopify, dans une langue donnée (repli FR). */
export async function getCoffretByHandle(handle: string, locale: Locale): Promise<CoffretContent | null> {
  const l = safeLocale(locale);
  const query = `*[_type == "coffret" && shopifyHandle == $handle][0]{
    shopifyHandle,
    "titre": coalesce(titre.${l}, titre.fr),
    "description": coalesce(description.${l}, description.fr),
    "contenance": coalesce(contenance.${l}, contenance.fr),
    image,
    "perfumerWord": coalesce(perfumerWord.${l}, perfumerWord.fr),
    perfumerPhoto,
    "faqs": faqs[]->{
      "question": coalesce(question.${l}, question.fr),
      "reponse": coalesce(reponse.${l}, reponse.fr)
    },
    "parfums": parfums[]->{
      shopifyHandle,
      "nom": nomAffiche,
      "notes": {
        "tete": notesTete${coffretNoteCards(l)},
        "coeur": notesCoeur${coffretNoteCards(l)},
        "fond": notesFond${coffretNoteCards(l)}
      }
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

// ---------- Luma (conseillère IA) ----------

/**
 * Ce que Luma a le droit de lire dans Sanity pour un parfum — et seulement ça.
 *
 * Liste blanche volontaire, décidée sur l'état RÉEL du dataset le 10 septembre
 * 2026 (voir src/lib/luma/knowledge.ts) : les notes sont justes pour les six
 * Reflets, `inspiredBy` et `bestSeller` aussi, `familles` là où il est rempli,
 * et `description` a été réécrit pour la nouvelle collection (FR et EN ; l'AR
 * retombe sur le FR). En revanche `accroche`, `specificTwist`, `blocs` et
 * `familleOlfactive` portent encore les textes de l'ancienne collection sous
 * les nouveaux noms (section 12 du document persona) : ils ne sont PAS
 * projetés ici, à dessein. Un champ rempli n'est pas un champ juste — c'est
 * toute la raison d'être de cette liste.
 *
 * `pt::text` aplatit le Portable Text : Luma parle, elle ne met pas en page.
 */
export type LumaParfumDoc = {
  shopifyHandle: string;
  inspiredBy: string | null;
  bestSeller: boolean | null;
  familles: string | null;
  description: string | null;
  notes: { tete: string[]; coeur: string[]; fond: string[] };
};

export async function getLumaParfums(locale: Locale): Promise<LumaParfumDoc[]> {
  const l = safeLocale(locale);
  const names = `[]->{ "nom": coalesce(nom.${l}, nom.fr) }.nom`;
  const query = `*[_type == "parfum" && defined(shopifyHandle)]{
    shopifyHandle,
    inspiredBy,
    bestSeller,
    "familles": coalesce(familles.${l}, familles.fr),
    "description": pt::text(coalesce(description.${l}, description.fr)),
    "notes": {
      "tete": coalesce(notesTete${names}, []),
      "coeur": coalesce(notesCoeur${names}, []),
      "fond": coalesce(notesFond${names}, [])
    }
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
