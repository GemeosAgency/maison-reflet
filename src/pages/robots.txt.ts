import type { APIRoute } from "astro";

// Robots piloté par la même variable que le noindex du Layout :
// pré-lancement (PUBLIC_ALLOW_INDEXING != "true") → on bloque tout crawl ;
// au lancement, passer PUBLIC_ALLOW_INDEXING=true sur la prod.
const indexable = import.meta.env.PUBLIC_ALLOW_INDEXING === "true";

export const GET: APIRoute = () => {
  const body = indexable
    ? "User-agent: *\nAllow: /\n"
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
