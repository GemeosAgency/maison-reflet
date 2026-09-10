/**
 * Accès aux sources pour knowledge.ts — la seule partie qui touche au réseau.
 *
 * Relu à chaque tour de conversation, avec un cache d'une minute par couple
 * pays/langue : invisible pour un visiteur, et ça évite d'interroger Shopify
 * et Sanity à chaque message. Le cache est en mémoire d'instance — sur Vercel,
 * chaque fonction repart froide, ce qui borne de fait sa durée de vie.
 */

import type { Locale } from "../../i18n";
import { getCountry } from "../markets";
import { getLumaParfums } from "../sanity";
import { getAllProducts } from "../shopify";
import { buildKnowledge, type Knowledge } from "./knowledge";

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Knowledge }>();

export async function getKnowledge(opts: {
  country?: string | null;
  locale: Locale;
  now?: Date;
}): Promise<Knowledge> {
  const country = getCountry(opts.country);
  const key = `${country.code}:${opts.locale}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const [products, parfums] = await Promise.all([
    // 50 : marge pour les produits à venir, sans pagination à gérer.
    getAllProducts(50, { country: country.code, language: opts.locale.toUpperCase() }),
    getLumaParfums(opts.locale),
  ]);

  const value = buildKnowledge({ products, parfums, country, locale: opts.locale, now: opts.now });
  cache.set(key, { at: Date.now(), value });
  return value;
}
