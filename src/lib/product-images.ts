export type ProductGalleryImage = {
  src: string;
  srcset: string;
  alt: string;
};

type ProductImageOverride = {
  aliases: string[];
  sources: string[];
};

// Galeries validées dans Figma. Shopify reste la source par défaut ; seuls les
// produits listés ici utilisent ces visuels locaux en priorité.
const PRODUCT_IMAGE_OVERRIDES: ProductImageOverride[] = [
  {
    aliases: ["bois-alert"],
    sources: Array.from({ length: 6 }, (_, i) => `/products/bois-alert/0${i + 1}.jpg`),
  },
  {
    aliases: ["melting-mango"],
    sources: Array.from({ length: 6 }, (_, i) => `/products/melting-mango/0${i + 1}.jpg`),
  },
  {
    aliases: ["fifth-season", "fith-seadon"],
    sources: Array.from({ length: 6 }, (_, i) => `/products/fifth-season/0${i + 1}.jpg`),
  },
  {
    aliases: ["ultra-cuir"],
    sources: Array.from({ length: 6 }, (_, i) => `/products/ultra-cuir/0${i + 1}.jpg`),
  },
];

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
    override?.sources.map((src, index) => ({
      src,
      srcset: "",
      alt: index === 0 ? title : `${title} — visuel ${index + 1}`,
    })) ?? null
  );
}
