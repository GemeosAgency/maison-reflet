/**
 * Accès aux sources pour knowledge.ts — la seule partie qui touche au réseau.
 *
 * Le catalogue doit rester vivant (exigence de Sandro : prix, produits,
 * ruptures sans redéploiement) sans faire attendre le visiteur. D'où un cache
 * « stale-while-revalidate » : on sert ce qu'on a et, passé une minute, on
 * relit Shopify et Sanity en tâche de fond pour le tour suivant. Le visiteur
 * n'attend une lecture que sur la toute première requête d'une instance, ou
 * si la version en cache a plus de dix minutes. Mesuré en dev : la lecture
 * coûte 1,1 s ; ce cache la sort du chemin critique.
 *
 * Le cache est en mémoire d'instance — sur Vercel, chaque fonction repart
 * froide, ce qui borne de fait sa durée de vie.
 */

import type { Locale } from "../../i18n";
import { getCountry, type Country } from "../markets";
import { getLumaParfums } from "../sanity";
import { getAllProducts } from "../shopify";
import { buildKnowledge, type Knowledge } from "./knowledge";

/** Au-delà : on rafraîchit en tâche de fond, sans faire attendre. */
const FRESH_MS = 60_000;
/** Au-delà : trop vieux pour être servi, on attend le rafraîchissement. */
const MAX_AGE_MS = 10 * 60_000;

type Entry = { at: number; value: Knowledge; refreshing: Promise<Knowledge> | null };
const cache = new Map<string, Entry>();

async function read(country: Country, locale: Locale, now?: Date): Promise<Knowledge> {
  const [products, parfums] = await Promise.all([
    // 50 : marge pour les produits à venir, sans pagination à gérer.
    getAllProducts(50, { country: country.code, language: locale.toUpperCase() }),
    getLumaParfums(locale),
  ]);
  return buildKnowledge({ products, parfums, country, locale, now });
}

export async function getKnowledge(opts: {
  country?: string | null;
  locale: Locale;
  now?: Date;
}): Promise<Knowledge> {
  const country = getCountry(opts.country);
  const key = `${country.code}:${opts.locale}`;
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;

  if (hit && age < FRESH_MS) return hit.value;

  // Un seul rafraîchissement à la fois par clé, même si dix tours arrivent ensemble.
  const refresh =
    hit?.refreshing ??
    read(country, opts.locale, opts.now)
      .then((value) => {
        cache.set(key, { at: Date.now(), value, refreshing: null });
        return value;
      })
      .catch((error) => {
        if (hit) hit.refreshing = null;
        throw error;
      });
  if (hit) hit.refreshing = refresh;

  if (hit && age < MAX_AGE_MS) {
    // Servi tel quel ; l'échec éventuel du rafraîchissement ne concerne pas ce tour.
    refresh.catch((error) => console.error("[luma/knowledge] rafraîchissement échoué :", error));
    return hit.value;
  }
  return refresh;
}
