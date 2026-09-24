export type ProductGalleryImage = {
  src: string;
  srcset: string;
  alt: string;
};

type ProductImageOverride = {
  aliases: string[];
  directory: string;
  count: number;
};

// Galeries validées dans Figma. Shopify reste la source par défaut ; seuls les
// produits listés ici utilisent ces visuels locaux en priorité.
const PRODUCT_IMAGE_OVERRIDES: ProductImageOverride[] = [
  {
    aliases: ["bois-alert"],
    directory: "bois-alert",
    count: 6,
  },
  {
    aliases: ["melting-mango"],
    directory: "melting-mango",
    count: 6,
  },
  {
    aliases: ["fifth-season", "fith-seadon"],
    directory: "fifth-season",
    count: 6,
  },
  {
    aliases: ["ultra-cuir"],
    directory: "ultra-cuir",
    count: 6,
  },
];

// 160 px sert aux vignettes du menu, 480/960 au carrousel mobile et 1400 à
// la mosaïque/visionneuse. Les JPEG x2 restent le repli haute définition ; les
// navigateurs courants choisissent les WebP beaucoup plus légers via srcset.
const RESPONSIVE_WIDTHS = [160, 480, 960, 1400];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getProductImageOverride(
  handle: string,
  title: string
): ProductGalleryImage[] | null {
  const identity = `${normalize(handle)} ${normalize(title)}`;
  const override = PRODUCT_IMAGE_OVERRIDES.find((set) =>
    set.aliases.some((alias) => identity.includes(alias))
  );

  return (
    override
      ? Array.from({ length: override.count }, (_, index) => {
          const stem = `/products/${override.directory}/0${index + 1}`;
          return {
            // Repli universel et source HD pour le partage/les vieux navigateurs.
            src: `${stem}.jpg`,
            srcset: RESPONSIVE_WIDTHS.map((width) => `${stem}-${width}.webp ${width}w`).join(", "),
            alt: index === 0 ? title : `${title} — visuel ${index + 1}`,
          };
        })
      : null
  );
}

/*
 * Photo du survol des tuiles (catalogue, accueil, « Vous aimerez aussi ») : la
 * quatrième de la galerie, celle qui s'affiche en large au milieu de la
 * mosaïque de la fiche (Sandro, 24 sept.). Elle passe avant le survol Sanity ;
 * un produit sans galerie validée garde l'ancienne chaîne de repli.
 */
const HOVER_INDEX = 3;

export function getProductHoverImage(handle: string, title: string): ProductGalleryImage | null {
  return getProductImageOverride(handle, title)?.[HOVER_INDEX] ?? null;
}

/** Même photo en une seule URL, pour les cartes qui ne prennent pas de srcset. */
export function getProductHoverSrc(handle: string, title: string): string | null {
  const image = getProductHoverImage(handle, title);
  return image ? image.src.replace(/\.jpg$/, "-960.webp") : null;
}
