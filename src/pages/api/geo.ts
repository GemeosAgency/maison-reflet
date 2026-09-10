/**
 * Pays du visiteur, d'après l'infrastructure.
 *
 * Le site est en sortie statique : le middleware Astro s'exécute au BUILD et ne
 * voit jamais les en-têtes de la requête réelle. Cette route, elle, est rendue
 * à la demande (`prerender = false`) — c'est le seul endroit du site qui lit
 * `x-vercel-ip-country`.
 *
 * Aucune donnée n'est stockée ni journalisée : on renvoie deux lettres, que le
 * navigateur transforme en SUGGESTION de pays (voir `src/lib/country.ts`).
 * `Cache-Control: private` interdit toute mise en cache partagée — un pays mis
 * en cache par le CDN serait servi au visiteur suivant, où qu'il soit.
 */

import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const headers = request.headers;
  const country =
    headers.get("x-vercel-ip-country") ||
    // Replis utiles en local et derrière d'autres CDN.
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code") ||
    null;

  return new Response(JSON.stringify({ country: country?.toUpperCase() ?? null }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
};
