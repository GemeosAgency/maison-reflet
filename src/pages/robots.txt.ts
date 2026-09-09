import type { APIRoute } from "astro";

/**
 * robots.txt généré (et non un fichier statique) parce que la règle dépend de
 * l'environnement : staging doit rester fermé aux moteurs, la prod ouverte.
 * Même drapeau que la balise <meta name="robots"> du Layout, pour qu'on ne
 * puisse pas avoir un site en noindex mais un robots.txt permissif.
 */
export const GET: APIRoute = ({ site }) => {
  const indexable = import.meta.env.PUBLIC_ALLOW_INDEXING === "true";

  const body = indexable
    ? [
        "User-agent: *",
        "Allow: /",
        "",
        // Le checkout et le panier n'ont rien à faire dans l'index.
        "Disallow: /*/panier",
        "",
        site ? `Sitemap: ${new URL("sitemap-index.xml", site).href}` : "",
      ]
    : [
        // Staging / preview : tout est fermé.
        "User-agent: *",
        "Disallow: /",
      ];

  return new Response(body.filter((l) => l !== "").join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
