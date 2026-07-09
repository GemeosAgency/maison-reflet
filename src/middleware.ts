import { defineMiddleware } from "astro:middleware";

// Mode « site en cours de développement » : quand PUBLIC_COMING_SOON === "true"
// (activé sur la prod uniquement), toutes les pages HTML renvoient un holding
// page. Le staging n'a pas la variable → il sert le site complet.
// Le jour du lancement : retirer PUBLIC_COMING_SOON de la prod.
const COMING_SOON = import.meta.env.PUBLIC_COMING_SOON === "true";

const HOLDING_PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Maison Reflet — Bientôt</title>
    <style>
      :root { color-scheme: dark; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0b0b0c;
        color: #f4f1ea;
        font-family: "Times New Roman", Georgia, serif;
        text-align: center;
        padding: 2rem;
      }
      .wrap { max-width: 34rem; }
      .brand {
        font-size: clamp(2rem, 6vw, 3.25rem);
        letter-spacing: 0.28em;
        text-transform: uppercase;
        font-weight: 400;
      }
      .rule {
        width: 3rem;
        height: 1px;
        background: #b9a779;
        margin: 2rem auto;
      }
      .tagline {
        font-size: 1.05rem;
        letter-spacing: 0.05em;
        line-height: 1.7;
        color: #cfc9bd;
      }
      .soon {
        margin-top: 2.5rem;
        font-size: 0.8rem;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: #b9a779;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1 class="brand">Maison Reflet</h1>
      <div class="rule"></div>
      <p class="tagline">
        Dix parfums, dix reflets d'une identité franco-arabe.<br />
        Une maison en train de voir le jour.
      </p>
      <p class="soon">Bientôt / قريبًا</p>
    </main>
  </body>
</html>
`;

export const onRequest = defineMiddleware((context, next) => {
  // On laisse passer robots.txt pour garder le contrôle d'indexation intact.
  if (COMING_SOON && !context.url.pathname.startsWith("/robots")) {
    return new Response(HOLDING_PAGE, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return next();
});
