/**
 * Pastille et mention des cartes produit pendant la prévente.
 *
 * Les cartes (ProductCard, ProductTile) la calculent elles-mêmes depuis la
 * langue de la page plutôt que de la recevoir de chaque appelant : tant que la
 * prévente est ouverte, « PRÉCOMMANDE » remplace toute autre pastille. Pas de
 * « Best seller » tant que rien n'est vendu (Sandro, 30 oct.).
 *
 * Module serveur (il lit Sanity) : prevente.ts, lui, reste importable côté
 * navigateur.
 */
import { getPrevente } from "./sanity";
import { formatPrice, getCompareAtPrice, getPrimaryVariant, type ShopifyProduct } from "./shopify";
import { intlLocale } from "./markets";
import { locales, useTranslations, type Locale } from "../i18n";

export type PreventeCard = { badge: string; launchLabel: string | null };

export async function preventeCard(lang: string | undefined, hasCompare: boolean): Promise<PreventeCard | null> {
  if (!lang || !(locales as readonly string[]).includes(lang)) return null;
  const prevente = await getPrevente();
  if (!prevente.active) return null;
  const t = useTranslations(lang as Locale);
  return { badge: t("prevente.cardBadge"), launchLabel: hasCompare ? t("prevente.launchPrice") : null };
}

/**
 * Le bloc prévente des fiches (parfum et coffret) : pastille, « Prix de
 * lancement », encadré « en production, expédition sous 2 mois environ »
 * (Sandro, 30 oct.) avec l'économie quand Shopify porte un prix barré. Pas de
 * date : le délai reste volontairement approximatif. null hors prévente.
 */
export async function preventePanel(lang: Locale, product: ShopifyProduct, name: string) {
  const prevente = await getPrevente();
  if (!prevente.active) return null;
  const t = useTranslations(lang);
  const variant = getPrimaryVariant(product);
  const compareAt = getCompareAtPrice(product);
  const saving = compareAt
    ? formatPrice(String(Number(compareAt.amount) - Number(variant.price.amount)), variant.price.currencyCode, intlLocale(lang))
    : null;
  return {
    badge: t("prevente.badge"),
    launchLabel: t("prevente.launchPrice"),
    infoTitle: t("prevente.infoTitle"),
    // HTML : l'économie est relue dans la devise du pays (data-money-saving).
    infoBody: (saving
      ? t("prevente.infoBody").replace("{saving}", `<span data-money-saving="${variant.id}">${saving}</span>`)
      : t("prevente.infoBodyPlain")
    ).replace("{name}", name),
    shipShort: t("prevente.shipShort"),
  };
}
