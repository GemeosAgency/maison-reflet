/**
 * Marchés, devises et promesse de livraison.
 *
 * Source de vérité UNIQUE, partagée par le build (Astro) et le navigateur
 * (sélecteur de pays, panier, hydratation des prix). Elle décrit exactement
 * les 32 pays des zones de livraison Shopify — « Domestic » (Émirats),
 * « Golfe (CCG) » (5 pays) et « International » (26 pays).
 *
 * Six devises, huit marchés : Émirats (AED), Golfe (AED), Arabie saoudite
 * (SAR), Europe continentale (EUR), Royaume-Uni (GBP), Suisse (CHF),
 * Amériques (USD), Asie-Pacifique (USD). Une devise par marché, pour que
 * chaque prix puisse être fixé rond au lieu d'être converti automatiquement —
 * la grille et les mutations qui restent à passer sont dans
 * `docs/grille-tarifaire.md`.
 *
 * ⚠️ À garder synchronisé avec Shopify si les zones changent :
 *   Admin > Paramètres > Expédition > General profile.
 *
 * Les NOMS de pays ne sont pas écrits ici : `Intl.DisplayNames` les traduit
 * dans les trois langues du site sans qu'on maintienne 84 chaînes à la main.
 */

import type { Locale } from "../i18n";

/** Zones de livraison, telles que définies dans le profil Shopify. */
export type ShippingZone = "domestic" | "international";

/** Regroupements du sélecteur — purement présentationnels. */
export type MarketGroup = "gulf" | "europe" | "americas" | "apac";

export type Country = {
  /** ISO 3166-1 alpha-2, en majuscules — le format attendu par `@inContext`. */
  code: string;
  /**
   * Devise du MARCHÉ auquel le pays appartient, pas la monnaie nationale : un
   * Suédois paie en euros, un Japonais en dollars. Shopify ne fixe un prix que
   * par marché, et un marché n'a qu'une devise — c'est le prix de prix ronds
   * partout plutôt que de conversions automatiques à 74,90 €.
   */
  currency: string;
  zone: ShippingZone;
  group: MarketGroup;
};

/**
 * Les 28 pays livrés. La devise est celle que Shopify attribue au pays via les
 * « devises locales » du marché : tant que les marchés ne sont pas créés côté
 * Shopify, l'API répond en AED et le site affiche l'AED — la dégradation est
 * silencieuse et sans casse.
 */
export const COUNTRIES: Country[] = [
  // Golfe — l'Arabie saoudite a son propre marché (marché prioritaire de la
  // marque) ; ses voisins restent en AED, toutes leurs devises étant arrimées
  // au dollar comme le dirham, et l'AED se lisant dans tout le Golfe.
  { code: "AE", currency: "AED", zone: "domestic", group: "gulf" },
  { code: "SA", currency: "SAR", zone: "international", group: "gulf" },
  { code: "BH", currency: "AED", zone: "international", group: "gulf" },
  { code: "KW", currency: "AED", zone: "international", group: "gulf" },
  { code: "OM", currency: "AED", zone: "international", group: "gulf" },
  { code: "QA", currency: "AED", zone: "international", group: "gulf" },

  // Europe continentale en euros ; le Royaume-Uni et la Suisse ont leur propre
  // marché, leur devise pesant assez pour justifier une liste de prix.
  { code: "AT", currency: "EUR", zone: "international", group: "europe" },
  { code: "BE", currency: "EUR", zone: "international", group: "europe" },
  { code: "CH", currency: "CHF", zone: "international", group: "europe" },
  { code: "CZ", currency: "EUR", zone: "international", group: "europe" },
  { code: "DE", currency: "EUR", zone: "international", group: "europe" },
  { code: "DK", currency: "EUR", zone: "international", group: "europe" },
  { code: "ES", currency: "EUR", zone: "international", group: "europe" },
  { code: "FI", currency: "EUR", zone: "international", group: "europe" },
  { code: "FR", currency: "EUR", zone: "international", group: "europe" },
  { code: "GB", currency: "GBP", zone: "international", group: "europe" },
  { code: "IE", currency: "EUR", zone: "international", group: "europe" },
  { code: "IT", currency: "EUR", zone: "international", group: "europe" },
  { code: "NL", currency: "EUR", zone: "international", group: "europe" },
  { code: "NO", currency: "EUR", zone: "international", group: "europe" },
  { code: "PL", currency: "EUR", zone: "international", group: "europe" },
  { code: "PT", currency: "EUR", zone: "international", group: "europe" },
  { code: "SE", currency: "EUR", zone: "international", group: "europe" },

  // Amériques et Asie-Pacifique partagent le dollar : sept devises locales de
  // plus voudraient dire sept marchés et sept listes de prix, pour un gain de
  // lisibilité faible au lancement. Le JPY s'ouvrira si le Japon décolle.
  { code: "CA", currency: "USD", zone: "international", group: "americas" },
  { code: "US", currency: "USD", zone: "international", group: "americas" },

  { code: "AU", currency: "USD", zone: "international", group: "apac" },
  { code: "HK", currency: "USD", zone: "international", group: "apac" },
  { code: "JP", currency: "USD", zone: "international", group: "apac" },
  { code: "KR", currency: "USD", zone: "international", group: "apac" },
  { code: "MY", currency: "USD", zone: "international", group: "apac" },
  { code: "NZ", currency: "USD", zone: "international", group: "apac" },
  { code: "SG", currency: "USD", zone: "international", group: "apac" },
];

/** Pays servi par défaut : le marché primaire Shopify. */
export const DEFAULT_COUNTRY = "AE";

/**
 * Cookie du pays choisi. Déclaré ici et non dans country.ts, parce qu'il est
 * posé côté serveur par la racine (`src/pages/index.astro`, la seule page qui
 * voit l'IP du visiteur) et relu côté navigateur.
 */
export const COUNTRY_COOKIE = "mr_country";
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const GROUP_ORDER: MarketGroup[] = ["gulf", "europe", "americas", "apac"];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string | null | undefined): Country {
  return BY_CODE.get(String(code ?? "").toUpperCase()) ?? BY_CODE.get(DEFAULT_COUNTRY)!;
}

export function isShippedCountry(code: string | null | undefined): boolean {
  return BY_CODE.has(String(code ?? "").toUpperCase());
}

/**
 * Seuils de livraison offerte, par devise.
 *
 * Shopify n'applique qu'UNE remise automatique « Free shipping », dont le
 * minimum est fixé à 400 AED et converti à la volée dans la devise du client.
 * Le site, lui, doit annoncer un seuil AVANT le paiement : d'où cette table.
 *
 * Chaque valeur vaut 1,25 fois le prix du 75 ml sur son marché — le même
 * rapport que les 400 AED d'origine — et non une conversion des 400 AED :
 * comme les prix sont fixés par marché, le seuil doit suivre le prix local,
 * pas le taux de change.
 */
export const FREE_SHIPPING_THRESHOLDS: Record<string, number> = {
  AED: 400,
  SAR: 450,
  EUR: 125,
  GBP: 110,
  CHF: 125,
  USD: 125,
};

/**
 * Frais de port forfaitaires, par devise — mêmes règles d'arrondi que
 * ci-dessus, appliquées aux 25 AED (Émirats) et 70 AED (international).
 * `domestic` ne concerne que l'AED ; les autres devises n'ont que le tarif
 * international.
 */
export const SHIPPING_RATES: Record<string, { domestic?: number; international: number }> = {
  AED: { domestic: 25, international: 70 },
  SAR: { international: 80 },
  EUR: { international: 18 },
  GBP: { international: 15 },
  CHF: { international: 18 },
  USD: { international: 20 },
};

export function freeShippingThreshold(currency: string): number {
  return FREE_SHIPPING_THRESHOLDS[currency] ?? FREE_SHIPPING_THRESHOLDS.AED;
}

/**
 * Frais de port pour une zone, dans une devise donnée.
 *
 * La devise est un ARGUMENT et non `country.currency` : tant que le marché du
 * pays n'existe pas côté Shopify, l'API répond en AED, et il faut alors
 * annoncer 70 AED pour une livraison en France — pas 20 € que le paiement ne
 * pratiquerait pas. Voir `activeCurrency` dans country.ts.
 */
export function shippingRate(zone: ShippingZone, currency: string): number {
  const rates = SHIPPING_RATES[currency] ?? SHIPPING_RATES.AED;
  return zone === "domestic" ? (rates.domestic ?? rates.international) : rates.international;
}

/**
 * Délais de livraison annoncés, en jours ouvrés, par groupe de marchés.
 * Aucun délai n'est renseigné côté Shopify (`methodDefinitions` sans
 * description) : ces valeurs sont éditoriales et se règlent ici, à un seul
 * endroit, pour les trois langues.
 *
 * ⚠️ `gulf` vaut pour le Golfe HORS Émirats. Les Émirats sont le seul marché
 * domestique et ont leur propre délai, `UAE_DELIVERY_DAYS` — sans quoi
 * l'expédition vers Riyad aurait hérité du « 1 à 2 jours » de Dubaï.
 */
export const UAE_DELIVERY_DAYS = { min: 1, max: 2 };

export const DELIVERY_DAYS: Record<MarketGroup, { min: number; max: number }> = {
  gulf: { min: 3, max: 5 },
  europe: { min: 5, max: 8 },
  americas: { min: 7, max: 12 },
  apac: { min: 7, max: 12 },
};

/* ------------------------------------------------------------------ *
 * Livraison le jour même à Dubaï
 * ------------------------------------------------------------------ */

/**
 * Heure limite (heure de Dubaï) pour une livraison le jour même à Dubaï.
 * Le reste des Émirats reste sur le délai `gulf` — d'où la mention explicite
 * de l'émirat dans les libellés : on ne promet le jour même qu'à Dubaï.
 */
export const SAME_DAY_CUTOFF_HOUR = 14;
export const DUBAI_TIME_ZONE = "Asia/Dubai";

/** Week-end émirati depuis 2022 : samedi et dimanche. */
const UAE_WEEKEND = [0, 6];

export type SameDayStatus = {
  /** La commande passée maintenant part-elle aujourd'hui ? */
  open: boolean;
  /** Millisecondes restantes avant la limite — 0 si fermé. */
  msLeft: number;
};

/**
 * Calcule l'état de l'offre « jour même », à l'heure de Dubaï, quel que soit
 * le fuseau du visiteur : on lit l'heure de Dubaï via `Intl` plutôt que de
 * décaler `Date` à la main, ce qui reste juste si les Émirats adoptaient un
 * jour l'heure d'été.
 */
export function sameDayStatus(now: Date = new Date()): SameDayStatus {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = weekdays.indexOf(get("weekday"));
  // `hour12: false` peut rendre "24" pour minuit selon l'implémentation.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  if (UAE_WEEKEND.includes(weekday)) return { open: false, msLeft: 0 };

  const secondsNow = hour * 3600 + minute * 60 + second;
  const secondsCutoff = SAME_DAY_CUTOFF_HOUR * 3600;
  if (secondsNow >= secondsCutoff) return { open: false, msLeft: 0 };

  return { open: true, msLeft: (secondsCutoff - secondsNow) * 1000 };
}

/* ------------------------------------------------------------------ *
 * Formatage
 * ------------------------------------------------------------------ */

/** Étiquette BCP 47 pour `Intl`, dérivée de la langue du site. */
export function intlLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-AE" : "en-AE";
}

/** Nom du pays dans la langue du site — « France », « فرنسا », « France ». */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Symbole étroit d'une devise — « € », « £ », « د.إ ».
 *
 * `Intl` ne connaît pas de symbole pour toutes les devises dans toutes les
 * langues : en français, le dirham revient sous son code, « AED ». D'où la
 * cascade — la langue de la page, puis l'arabe (qui rend bien « د.إ », comme
 * la maquette), puis rien. Renvoyer `null` plutôt que le code évite la
 * pastille « AE (AED AED) ».
 */
export function currencySymbol(currency: string, locale: Locale): string | null {
  for (const tag of [intlLocale(locale), "ar-AE"]) {
    try {
      const symbol = new Intl.NumberFormat(tag, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value;
      if (symbol && symbol !== currency) return symbol;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Étiquette de la pastille du header : « AE (AED د.إ) », « FR (EUR €) ».
 *
 * `currency` est explicite pour que la pastille annonce la devise RÉELLEMENT
 * pratiquée, et non celle du marché espéré : afficher « FR (EUR €) » au-dessus
 * de prix en dirhams serait le pire des deux mondes.
 */
export function countryPill(country: Country, locale: Locale, currency = country.currency): string {
  const symbol = currencySymbol(currency, locale);
  return `${country.code} (${currency}${symbol ? ` ${symbol}` : ""})`;
}

/**
 * Montant dans la devise du marché. Les devises sans décimales (JPY, KRW) sont
 * gérées par `Intl` ; on force juste l'absence de centimes sur les montants
 * ronds, parce que la marque affiche des prix ronds (« 400 AED », pas
 * « 400,00 AED »).
 */
export function formatMoney(amount: number | string, currency: string, locale: Locale): string {
  const value = Number(amount);
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}
