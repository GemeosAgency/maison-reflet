/**
 * Données de la bannière « The Discovery Set » (DiscoverySetBanner) : le
 * coffret dont le handle évoque un set d'échantillons, sinon le premier.
 * Contenu éditorial depuis Sanity, prix depuis Shopify.
 *
 * Même sélection que l'accueil et le catalogue, qui la construisent encore
 * chacun de leur côté ; La Maison passe par ici.
 */
import { localePath, type Locale } from "../i18n";
import { getCoffrets, responsiveImage, type ResponsiveImage } from "./sanity";
import { formatPrice, getAllProducts, getPrimaryVariant, isCoffret, shopifyImage } from "./shopify";

export type DiscoveryBanner = {
  handle: string;
  titre: string;
  description: string | null;
  img: ResponsiveImage | null;
  price: string;
  href: string;
};

export async function getDiscoveryBanner(lang: Locale): Promise<DiscoveryBanner | null> {
  const [products, content] = await Promise.all([getAllProducts(), getCoffrets(lang)]);
  const coffrets = products.filter(isCoffret);
  const candidates = content
    .map((c): DiscoveryBanner | null => {
      const sp = coffrets.find((p) => p.handle === c.shopifyHandle);
      if (!sp) return null;
      const variant = getPrimaryVariant(sp);
      return {
        handle: sp.handle,
        titre: c.titre ?? sp.title,
        description: c.description,
        img: c.image
          ? responsiveImage(c.image as any, { widths: [640, 960, 1280, 1600], aspect: 816 / 560 })
          : sp.featuredImage
            ? shopifyImage(sp.featuredImage, [640, 960, 1280, 1600])
            : null,
        price: formatPrice(variant.price.amount, variant.price.currencyCode),
        href: localePath(lang, `/coffrets/${sp.handle}`),
      };
    })
    .filter((c): c is DiscoveryBanner => c !== null);
  return candidates.find((c) => /sample|discovery|decouverte|découverte/i.test(c.handle)) ?? candidates[0] ?? null;
}
