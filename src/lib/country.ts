/**
 * Pays sélectionné, côté navigateur.
 *
 * Le site est statique : les prix sont cuits au build dans la devise du marché
 * primaire (AED). Ce module rattrape l'écart sans multiplier les builds — il
 * relit les prix des variantes présentes sur la page dans la devise du pays
 * choisi, en UNE requête, et remplace le texte des noeuds marqués
 * `data-money="<variantId>"`.
 *
 * Trois choses seulement portent le pays :
 *   1. un cookie `mr_country`, lisible aussi par une éventuelle fonction edge ;
 *   2. le contexte par défaut de `shopify.ts`, d'où découlent panier et checkout ;
 *   3. l'événement `country:changed`, pour que l'interface se remette à jour.
 */

import {
  setDefaultShopifyContext,
  shopifyFetch,
  formatPrice,
  updateCartBuyerIdentity,
  type ShopifyContext,
} from "./shopify";
import {
  COUNTRY_COOKIE,
  COUNTRY_COOKIE_MAX_AGE,
  DEFAULT_COUNTRY,
  getCountry,
  isShippedCountry,
  freeShippingThreshold,
  intlLocale,
  type Country,
} from "./markets";
import type { Locale } from "../i18n";

// Réexporté pour les appelants navigateur ; la déclaration vit dans markets.ts,
// que la racine peut importer côté serveur.
export { COUNTRY_COOKIE } from "./markets";

export type CountryChangedEvent = CustomEvent<{ country: Country }>;

/* ------------------------------------------------------------------ *
 * Lecture / écriture du choix
 * ------------------------------------------------------------------ */

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Pays retenu : le choix mémorisé s'il est livré, sinon les Émirats. */
export function selectedCountryCode(): string {
  const stored = readCookie(COUNTRY_COOKIE);
  return isShippedCountry(stored) ? stored!.toUpperCase() : DEFAULT_COUNTRY;
}

export function selectedCountry(): Country {
  return getCountry(selectedCountryCode());
}

/** Langue de la page — c'est `<html lang>` qui fait foi, pas le cookie. */
export function pageLocale(): Locale {
  const lang = document.documentElement.lang;
  return lang === "ar" || lang === "en" ? lang : "fr";
}

export function shopifyContext(): ShopifyContext {
  return { country: selectedCountryCode(), language: pageLocale().toUpperCase() };
}

/* ------------------------------------------------------------------ *
 * Devise effective
 * ------------------------------------------------------------------ */

/**
 * Devise que Shopify pratique RÉELLEMENT pour le pays choisi.
 *
 * Elle n'est pas déductible de `markets.ts` : si le marché du pays n'existe
 * pas encore côté Shopify, l'API ramène silencieusement la requête sur le
 * marché primaire et répond en AED — `localization.country.isoCode` vaut alors
 * « AE » alors qu'on a demandé « FR ». Annoncer « offerte dès 100 € » pendant
 * que les prix restent en dirhams serait une promesse fausse.
 *
 * On demande donc la réponse à Shopify, une fois par pays et par onglet. Le
 * jour où les marchés existent, le même code bascule tout seul en euros.
 */
let activeCurrency: string | null = null;

const CURRENCY_CACHE_PREFIX = "maison-reflet:currency:";

export function getActiveCurrency(): string {
  return activeCurrency ?? selectedCountry().currency;
}

export async function resolveCurrency(code = selectedCountryCode()): Promise<string> {
  const cacheKey = `${CURRENCY_CACHE_PREFIX}${code}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      activeCurrency = cached;
      return cached;
    }
  } catch {
    /* sessionStorage indisponible (navigation privée stricte) : on interroge */
  }

  const query = /* GraphQL */ `
    query MarketCurrency {
      localization {
        country {
          isoCode
          currency {
            isoCode
          }
        }
      }
    }
  `;

  try {
    const data = await shopifyFetch<{
      localization: { country: { isoCode: string; currency: { isoCode: string } } };
    }>(query, {}, { context: { country: code, language: pageLocale().toUpperCase() } });
    activeCurrency = data.localization.country.currency.isoCode;
    try {
      sessionStorage.setItem(cacheKey, activeCurrency);
    } catch {
      /* rien à mémoriser : on redemandera au prochain changement */
    }
  } catch {
    // Hors ligne ou quota : la devise attendue du marché reste le meilleur pari.
    activeCurrency = getCountry(code).currency;
  }
  return activeCurrency;
}

/* ------------------------------------------------------------------ *
 * Hydratation des prix
 * ------------------------------------------------------------------ */

type VariantPrice = { id: string; price: { amount: string; currencyCode: string } };

/**
 * Relit le prix des variantes marquées dans le DOM et réécrit leur libellé.
 *
 * Les noeuds portent `data-money="<gid de la variante>"` ; le libellé cuit au
 * build sert de repli et reste affiché si l'appel échoue (hors ligne, quota
 * Storefront) — on ne vide jamais un prix.
 *
 * Tant que les marchés Shopify ne sont pas créés, l'API renvoie de l'AED : la
 * fonction réécrit alors la même valeur, sans effet visible.
 */
export async function hydratePrices(root: ParentNode = document): Promise<void> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-money]"));
  const ids = Array.from(new Set(nodes.map((n) => n.dataset.money).filter(Boolean) as string[]));
  if (!ids.length) return;

  const query = /* GraphQL */ `
    query VariantPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          price {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  let prices: Map<string, VariantPrice["price"]>;
  try {
    const data = await shopifyFetch<{ nodes: (VariantPrice | null)[] }>(query, { ids });
    prices = new Map(
      data.nodes.filter((n): n is VariantPrice => Boolean(n?.id)).map((n) => [n.id, n.price])
    );
  } catch {
    return;
  }

  const locale = intlLocale(pageLocale());
  for (const node of nodes) {
    const price = node.dataset.money ? prices.get(node.dataset.money) : undefined;
    if (price) node.textContent = formatPrice(price.amount, price.currencyCode, locale);
  }
}

/**
 * Réécrit les seuils de livraison offerte annoncés hors panier (bandeau promo,
 * rassurance). Le panier a sa propre logique, incrémentale, dans CartDrawer.
 */
export function hydrateShippingThresholds(root: ParentNode = document): void {
  const currency = getActiveCurrency();
  const label = formatPrice(
    String(freeShippingThreshold(currency)),
    currency,
    intlLocale(pageLocale())
  );
  for (const node of root.querySelectorAll<HTMLElement>("[data-free-shipping-threshold]")) {
    // Le gabarit contient « {amount} » : on ne remplace que ce jeton, pour que
    // la phrase reste traduite côté serveur.
    const template = node.dataset.freeShippingThreshold || node.textContent || "";
    node.textContent = template.replace("{amount}", label);
  }
}

/* ------------------------------------------------------------------ *
 * Changement de pays
 * ------------------------------------------------------------------ */

const CART_ID_KEY = "maison-reflet:cartId";

/**
 * Enregistre le pays, recale le panier existant et rafraîchit l'affichage.
 *
 * L'ordre compte : le contexte d'abord (toute requête ultérieure en dépend),
 * puis le panier — `cartBuyerIdentityUpdate` est ce qui fait basculer la devise
 * du checkout, `@inContext` ne suffit pas.
 */
export async function setCountry(code: string): Promise<void> {
  const country = getCountry(code);
  document.cookie = `${COUNTRY_COOKIE}=${country.code}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; SameSite=Lax`;
  setDefaultShopifyContext(shopifyContext());

  const cartId = localStorage.getItem(CART_ID_KEY);
  if (cartId) {
    try {
      await updateCartBuyerIdentity(cartId, country.code);
    } catch {
      // Panier expiré ou pays refusé : on n'empêche pas le changement
      // d'affichage pour autant, le prochain ajout recréera un panier.
    }
  }

  // La devise d'abord : promesse de livraison et seuils en dépendent, et une
  // réponse tardive ferait clignoter le bandeau d'une devise à l'autre.
  await resolveCurrency(country.code);

  document.dispatchEvent(
    new CustomEvent("country:changed", { detail: { country } }) satisfies CountryChangedEvent
  );

  await hydratePrices();
  hydrateShippingThresholds();
}

/* ------------------------------------------------------------------ *
 * Détection à la première visite
 * ------------------------------------------------------------------ */

/**
 * Applique le pays du visiteur à la première visite.
 *
 * La racine (`src/pages/index.astro`) pose déjà le cookie côté serveur : ce
 * repli ne sert qu'aux arrivées en profondeur — lien partagé, résultat Google,
 * page mise en cache par le CDN — où aucune requête n'a vu l'IP du visiteur.
 * Le middleware Astro, lui, s'exécute au BUILD (sortie statique) et ne voit
 * jamais `x-vercel-ip-country` ; d'où la route à la demande `/api/geo`.
 *
 * Le pays est APPLIQUÉ, pas proposé : un visiteur français doit voir la
 * livraison vers la France sans rien cliquer. Il en est informé par une
 * mention discrète, avec un accès direct au tiroir pour changer — informer
 * après coup, plutôt que barrer la première visite d'une question.
 *
 * Renvoie le pays retenu quand il diffère du marché primaire, sinon `null` —
 * c'est ce qui déclenche la mention.
 */
export async function applyDetectedCountry(): Promise<Country | null> {
  if (readCookie(COUNTRY_COOKIE)) return null;
  try {
    const res = await fetch("/api/geo", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const { country } = (await res.json()) as { country?: string };
    if (!country || !isShippedCountry(country)) return null;

    const code = country.toUpperCase();
    // Mémorise le choix même quand c'est le pays par défaut : sans cookie, on
    // rappellerait /api/geo à chaque page pour rien.
    await setCountry(code);
    return code === DEFAULT_COUNTRY ? null : getCountry(code);
  } catch {
    return null;
  }
}

/**
 * Point d'entrée appelé par le layout : pose le contexte avant tout appel
 * Shopify, puis rattrape les prix si le pays n'est pas le marché primaire.
 */
export function initCountry(): void {
  setDefaultShopifyContext(shopifyContext());
  if (selectedCountryCode() === DEFAULT_COUNTRY) return;

  // Hors marché primaire, le HTML statique est en AED : on rattrape prix,
  // seuils et promesse de livraison dès que la devise réelle est connue.
  void resolveCurrency().then(() => {
    hydrateShippingThresholds();
    document.dispatchEvent(
      new CustomEvent("country:changed", {
        detail: { country: selectedCountry() },
      }) satisfies CountryChangedEvent
    );
    return hydratePrices();
  });
}
