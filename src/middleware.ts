import { defineMiddleware } from "astro:middleware";

// Mode « site en cours de développement » : quand PUBLIC_COMING_SOON === "true"
// (activé sur la prod uniquement), toutes les pages HTML renvoient un teaser.
// Le staging n'a pas la variable → il sert le site complet.
// Le jour du lancement : retirer PUBLIC_COMING_SOON de la prod.
const COMING_SOON = import.meta.env.PUBLIC_COMING_SOON === "true";

// Tracking onsite Klaviyo sur la page teaser (même variable que Layout.astro,
// voir le commentaire là-bas pour la limite mono-compte staging/prod).
const KLAVIYO_ID = import.meta.env.PUBLIC_KLAVIYO_COMPANY_ID;
const KLAVIYO_SNIPPET = KLAVIYO_ID
  ? `<script type="text/javascript" async src="https://static.klaviyo.com/onsite/js/${KLAVIYO_ID}/klaviyo.js"></script>`
  : "";

const HOLDING_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <title>Maison Reflet — The art of a different reflection</title>
    <meta property="og:title" content="Maison Reflet" />
    <meta property="og:description" content="The art of a different reflection. Get early access and be the first to discover the collection." />
    <meta property="og:image" content="/teaser/bg.jpg" />
    <link rel="preload" as="image" href="/teaser/bg.jpg" imagesrcset="/teaser/bg.jpg 1600w, /teaser/bg@2x.jpg 2560w" imagesizes="100vw" fetchpriority="high" />
    ${KLAVIYO_SNIPPET}
    <style>
      /* Mêmes fichiers que le site (public/fonts), pas de Google Fonts :
         la maquette du teaser n'utilise que PP Neue Montreal. */
      @font-face {
        font-family: "PP Neue Montreal";
        src: url("/fonts/ppneuemontreal-book.woff2") format("woff2");
        font-weight: 400; font-style: normal; font-display: swap;
      }
      @font-face {
        font-family: "PP Neue Montreal";
        src: url("/fonts/ppneuemontreal-medium.woff2") format("woff2");
        font-weight: 500; font-style: normal; font-display: swap;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        background: #150e0a;
        color: #f1eee9;
        font-family: "PP Neue Montreal", "Helvetica Neue", Arial, sans-serif;
        overflow: hidden;
      }
      .bg {
        position: fixed; inset: 0; z-index: 0;
        width: 100%; height: 100%; object-fit: cover;
        /* La photo est déjà recadrée au cadrage de la maquette. Le flacon est
           à ~70 % de la largeur : sur un écran étroit, un recadrage centré le
           couperait, d'où l'ancrage à 70 %. */
        object-position: 70% center;
      }
      /* La maquette ne porte qu'une ombre portée sur le titre. Ce voile très
         léger protège la même accroche quand le recadrage mobile ramène la
         zone claire de la photo derrière le texte. */
      .scrim {
        position: fixed; inset: 0; z-index: 1; pointer-events: none;
        background: linear-gradient(to top, rgba(21, 14, 10, 0.5) 0%, rgba(21, 14, 10, 0) 46%);
      }
      .frame {
        position: fixed; inset: 0; z-index: 2;
        display: flex; flex-direction: column;
        align-items: flex-start; justify-content: space-between;
        padding: 48px;
      }
      .logo { display: block; width: 272px; height: 32px; }
      .block { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
      h1 {
        max-width: 504px;
        font-size: clamp(28px, 2.78vw, 40px);
        font-weight: 500; line-height: 1.2; text-transform: uppercase;
        filter: drop-shadow(0 0 40px rgba(0, 0, 0, 0.56));
      }
      .signup { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
      .signup-lead { font-size: 16px; line-height: 1.32; letter-spacing: -0.32px; }
      .field {
        display: flex; align-items: center; gap: 12px;
        padding: 4px; background: rgba(231, 223, 208, 0.24);
      }
      .field input {
        width: 288px; padding: 16px; border: 0; background: none;
        color: #f1eee9; font: inherit; font-size: 16px; font-weight: 500;
        text-transform: uppercase; outline: none;
      }
      .field input::placeholder { color: rgba(241, 238, 233, 0.64); }
      .field input:focus-visible { outline: 1px solid rgba(241, 238, 233, 0.64); outline-offset: 2px; }
      .field button {
        display: inline-flex; align-items: center; gap: 12px;
        padding: 16px; border: 0; background: #812538;
        color: #f1eee9; font: inherit; font-size: 16px; font-weight: 500;
        text-transform: uppercase; cursor: pointer; transition: opacity 0.15s;
      }
      .field button:hover { opacity: 0.88; }
      .field button:disabled { opacity: 0.6; cursor: default; }
      .field button svg { width: 12px; height: auto; flex: none; }
      .signup-msg { min-height: 1.3em; font-size: 16px; line-height: 1.32; }
      .fadein { opacity: 0; animation: rise 1.2s ease forwards; }
      .fadein-2 { animation-delay: 0.12s; }
      @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

      @media (max-width: 700px) {
        .frame { padding: 24px; }
        .logo { width: 204px; height: 24px; }
        .block { gap: 20px; width: 100%; }
        .signup { width: 100%; }
        .field { width: 100%; flex-wrap: wrap; }
        .field input { flex: 1 1 12rem; width: auto; min-width: 0; }
        .field button { flex: 1 1 100%; justify-content: center; }
      }
      @media (prefers-reduced-motion: reduce) {
        .fadein { animation: none; opacity: 1; }
      }
    </style>
  </head>
  <body>
    <img
      class="bg"
      src="/teaser/bg.jpg"
      srcset="/teaser/bg.jpg 1600w, /teaser/bg@2x.jpg 2560w"
      sizes="100vw"
      alt=""
      fetchpriority="high"
      decoding="async"
    />
    <div class="scrim" aria-hidden="true"></div>
    <main class="frame">
      <img class="logo fadein" src="/teaser/logo.svg" alt="Maison Reflet" width="272" height="32" />
      <div class="block">
        <h1 class="fadein">The art of a<br />different reflection</h1>
        <div class="signup fadein fadein-2">
          <p class="signup-lead">Get early access and be the first to discover the collection</p>
          <form class="field" id="signup">
            <input
              type="email"
              name="email"
              required
              autocomplete="email"
              placeholder="Your email address"
              aria-label="Your email address"
            />
            <button type="submit">
              <span>Join the list</span>
              <svg viewBox="0 0 13.5 11.0459" fill="none" aria-hidden="true" focusable="false">
                <path d="M0.75 4.77297C0.335786 4.77297 0 5.10876 0 5.52297C0 5.93718 0.335786 6.27297 0.75 6.27297V5.52297V4.77297ZM13.2803 6.0533C13.5732 5.76041 13.5732 5.28553 13.2803 4.99264L8.50736 0.21967C8.21447 -0.0732231 7.73959 -0.0732231 7.4467 0.21967C7.15381 0.512564 7.15381 0.987437 7.4467 1.28033L11.6893 5.52297L7.4467 9.76561C7.15381 10.0585 7.15381 10.5334 7.4467 10.8263C7.73959 11.1192 8.21447 11.1192 8.50736 10.8263L13.2803 6.0533ZM0.75 5.52297V6.27297H12.75V5.52297V4.77297H0.75V5.52297Z" fill="#F1EEE9"/>
              </svg>
            </button>
          </form>
          <p class="signup-msg" id="signup-msg" role="status" aria-live="polite"></p>
        </div>
      </div>
    </main>
    <script>
      (function () {
        var f = document.getElementById("signup");
        var msg = document.getElementById("signup-msg");
        if (!f) return;
        f.addEventListener("submit", function (e) {
          e.preventDefault();
          var input = f.querySelector("input[name=email]");
          var btn = f.querySelector("button");
          var email = (input.value || "").trim();
          if (!email) return;
          btn.disabled = true;
          msg.textContent = "One moment…";
          fetch("/api/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, locale: "en", source: "teaser" }),
          })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
              if (res.ok && res.d && res.d.ok) {
                f.style.display = "none";
                msg.textContent = "Thank you. You will be among the first to know.";
                // Identifie aussi le profil dans Klaviyo (best effort, sans bloquer).
                // On attend que klaviyo.js soit réellement chargé (objet avec .push)
                // avant de pousser, sinon l'appel est perdu — cf. src/lib/klaviyo.ts.
                (function identifyWhenReady(tries) {
                  var k = window.klaviyo;
                  if (k && !Array.isArray(k) && typeof k.push === "function") {
                    try { k.push(["identify", { email: email }]); } catch (_) {}
                  } else if (tries > 0) {
                    setTimeout(function () { identifyWhenReady(tries - 1); }, 150);
                  }
                })(120);
              } else {
                msg.textContent = (res.d && res.d.error) || "Something went wrong.";
                btn.disabled = false;
              }
            })
            .catch(function () {
              msg.textContent = "Check your connection and try again.";
              btn.disabled = false;
            });
        });
      })();
    </script>
  </body>
</html>
`;

export const onRequest = defineMiddleware((context, next) => {
  // On ne remplace que les routes de pages : les fichiers (images du teaser,
  // robots.txt, css…) ont une extension et passent normalement, et l'API de
  // collecte d'emails (/api/*) doit rester joignable même en mode teaser.
  const path = context.url.pathname;
  const isAsset = /\.[a-z0-9]+$/i.test(path) || path.startsWith("/api/");
  if (COMING_SOON && !isAsset) {
    return new Response(HOLDING_PAGE, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return next();
});
