/**
 * La prévente : un seul réglage pour tout le site.
 *
 * Il vit dans Sanity (document « Réglages », champ `prevente`) pour que Sandro
 * l'ouvre, le ferme ou fixe la date d'expédition depuis le Studio. Le site est
 * statique : le réglage est lu au build (`getPrevente` dans sanity.ts), cuit
 * dans le HTML, et posé sur <html> (`data-prevente`, `data-prevente-ship`) pour
 * les scripts du navigateur — promesse de livraison, panier — qui n'ont pas à
 * refaire l'appel.
 *
 * La remise, elle, n'est PAS ici : Shopify reste la vérité des prix. Le prix de
 * prévente est le prix de vente, le prix normal est le `compareAtPrice` de la
 * variante, que le site affiche barré là où il existe.
 *
 * Ce module ne parle à aucune API : il est importé des deux côtés.
 */

import type { Locale } from "../i18n";

export type Prevente = {
  active: boolean;
  /** Date d'expédition annoncée (AAAA-MM-JJ), ou null tant qu'elle n'est pas fixée. */
  shipDate: string | null;
};

export const PREVENTE_OFF: Prevente = { active: false, shipDate: null };

const LOCALE_TAGS: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", ar: "ar-AE" };

/** « 1er décembre » / « 1 December » / « ١ ديسمبر » — sans l'année, qui est sous-entendue. */
export function formatShipDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Midi UTC : aucun fuseau ne fait basculer le jour.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const label = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return locale === "fr" && d === 1 ? label.replace(/^1 /, "1er ") : label;
}

/**
 * La ligne d'expédition de la prévente, dans la langue de la page. Les deux
 * gabarits viennent de i18n (`prevente.shipOn` avec `{date}`, `prevente.shipSoon`).
 */
export function preventeShipLine(
  p: Prevente,
  locale: Locale,
  strings: { shipOn: string; shipSoon: string }
): string {
  return p.shipDate
    ? strings.shipOn.replace("{date}", formatShipDate(p.shipDate, locale))
    : strings.shipSoon;
}

/** Lecture côté navigateur, depuis les attributs que pose le Layout. */
export function clientPrevente(): Prevente {
  const ds = document.documentElement.dataset;
  return { active: ds.prevente === "on", shipDate: ds.preventeShip || null };
}
