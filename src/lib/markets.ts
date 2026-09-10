/**
 * Marchés, devises et promesse de livraison.
 *
 * Source de vérité UNIQUE, partagée par le build (Astro) et le navigateur
 * (sélecteur de pays, panier, hydratation des prix). Elle décrit exactement
 * les 32 pays des zones de livraison Shopify — « Domestic » (Émirats),
 * « Golfe (CCG) » (5 pays) et « International » (26 pays) — et les cinq
 * marchés `ae` / `gcc` / `europe` / `americas` / `apac`.
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
  /** Devise que Shopify servira une fois le marché configuré (voir MARKETS ci-dessous). */
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
  { code: "AE", currency: "AED", zone: "domestic", group: "gulf" },
  { code: "BH", currency: "BHD", zone: "international", group: "gulf" },
  { code: "KW", currency: "KWD", zone: "international", group: "gulf" },
  { code: "OM", currency: "OMR", zone: "international", group: "gulf" },
  { code: "QA", currency: "QAR", zone: "international", group: "gulf" },
  { code: "SA", currency: "SAR", zone: "international", group: "gulf" },

  { code: "AT", currency: "EUR", zone: "international", group: "europe" },
  { code: "BE", currency: "EUR", zone: "international", group: "europe" },
  { code: "CH", currency: "CHF", zone: "international", group: "europe" },
  { code: "CZ", currency: "CZK", zone: "international", group: "europe" },
  { code: "DE", currency: "EUR", zone: "international", group: "europe" },
  { code: "DK", currency: "DKK", zone: "international", group: "europe" },
  { code: "ES", currency: "EUR", zone: "international", group: "europe" },
  { code: "FI", currency: "EUR", zone: "international", group: "europe" },
  { code: "FR", currency: "EUR", zone: "international", group: "europe" },
  { code: "GB", currency: "GBP", zone: "international", group: "europe" },
  { code: "IE", currency: "EUR", zone: "international", group: "europe" },
  { code: "IT", currency: "EUR", zone: "international", group: "europe" },
  { code: "NL", currency: "EUR", zone: "international", group: "europe" },
  { code: "NO", currency: "NOK", zone: "international", group: "europe" },
  { code: "PL", currency: "PLN", zone: "international", group: "europe" },
  { code: "PT", currency: "EUR", zone: "international", group: "europe" },
  { code: "SE", currency: "SEK", zone: "international", group: "europe" },

  { code: "CA", currency: "CAD", zone: "international", group: "americas" },
  { code: "US", currency: "USD", zone: "international", group: "americas" },

  { code: "AU", currency: "AUD", zone: "international", group: "apac" },
  { code: "HK", currency: "HKD", zone: "international", group: "apac" },
  { code: "JP", currency: "JPY", zone: "international", group: "apac" },
  { code: "KR", currency: "KRW", zone: "international", group: "apac" },
  { code: "MY", currency: "MYR", zone: "international", group: "apac" },
  { code: "NZ", currency: "NZD", zone: "international", group: "apac" },
  { code: "SG", currency: "SGD", zone: "international", group: "apac" },

];

/** Pays servi par défaut : le marché primaire Shopify. */
export const DEFAULT_COUNTRY = "AE";

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
 * Règle de sûreté : chaque valeur est arrondie AU-DESSUS de l'équivalent de
 * 400 AED, avec ~10 % de marge pour absorber la dérive des taux de change.
 * Sur-annoncer est sans danger (le client obtient la gratuité plus tôt que
 * promis) ; sous-annoncer promettrait une gratuité que le paiement refuserait.
 * À revoir si l'AED décroche de son ancrage au dollar.
 */
export const FREE_SHIPPING_THRESHOLDS: Record<string, number> = {
  AED: 400,
  SAR: 450,
  QAR: 440,
  KWD: 37,
  BHD: 45,
  OMR: 46,
  EUR: 100,
  USD: 110,
  GBP: 85,
  CHF: 95,
  CAD: 160,
  AUD: 175,
  NZD: 195,
  JPY: 17000,
  KRW: 160000,
  HKD: 900,
  SGD: 150,
  MYR: 490,
  SEK: 1100,
  NOK: 1200,
  DKK: 750,
  PLN: 430,
  CZK: 2450,
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
  QAR: { international: 78 },
  KWD: { international: 7 },
  BHD: { international: 8 },
  OMR: { international: 8 },
  EUR: { international: 20 },
  USD: { international: 22 },
  GBP: { international: 17 },
  CHF: { international: 19 },
  CAD: { international: 30 },
  AUD: { international: 32 },
  NZD: { international: 35 },
  JPY: { international: 3000 },
  KRW: { international: 28000 },
  HKD: { international: 160 },
  SGD: { international: 27 },
  MYR: { international: 88 },
  SEK: { international: 200 },
  NOK: { international: 210 },
  DKK: { international: 135 },
  PLN: { international: 78 },
  CZK: { international: 430 },
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
