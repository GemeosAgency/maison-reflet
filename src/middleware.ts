import { defineMiddleware } from "astro:middleware";

// Mode « site en cours de développement » : quand PUBLIC_COMING_SOON === "true"
// (activé sur la prod uniquement), toutes les pages HTML renvoient un teaser.
// Le staging n'a pas la variable → il sert le site complet.
// Le jour du lancement : retirer PUBLIC_COMING_SOON de la prod.
const COMING_SOON = import.meta.env.PUBLIC_COMING_SOON === "true";

const HOLDING_PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Maison Reflet — Bientôt</title>
    <meta property="og:title" content="Maison Reflet — Bientôt" />
    <meta property="og:description" content="Six parfums, six reflets d'une identité franco-arabe." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        background: #1c1714;
        color: #efe6d8;
        font-family: "Cormorant Garamond", Georgia, serif;
        overflow: hidden;
      }
      .stage { position: fixed; inset: 0; z-index: 0; }
      .slide {
        position: absolute; inset: 0;
        background-size: cover; background-position: center;
        opacity: 0;
        animation: fade 63s infinite;
        will-change: opacity, transform;
      }
      .slide:nth-child(1) { background-image: url("/teaser/t1.jpg"); animation-delay: 0s; }
      .slide:nth-child(2) { background-image: url("/teaser/t2.jpg"); animation-delay: 7s; }
      .slide:nth-child(3) { background-image: url("/teaser/t3.jpg"); animation-delay: 14s; }
      .slide:nth-child(4) { background-image: url("/teaser/t4.jpg"); animation-delay: 21s; }
      .slide:nth-child(5) { background-image: url("/teaser/t5.jpg"); animation-delay: 28s; }
      .slide:nth-child(6) { background-image: url("/teaser/t6.jpg"); animation-delay: 35s; }
      .slide:nth-child(7) { background-image: url("/teaser/t7.jpg"); animation-delay: 42s; }
      .slide:nth-child(8) { background-image: url("/teaser/t8.jpg"); animation-delay: 49s; }
      .slide:nth-child(9) { background-image: url("/teaser/t9.jpg"); animation-delay: 56s; }
      @keyframes fade {
        0%   { opacity: 0; transform: scale(1.06); }
        2%   { opacity: 1; }
        11%  { opacity: 1; }
        14%  { opacity: 0; transform: scale(1.12); }
        100% { opacity: 0; transform: scale(1.12); }
      }
      .overlay {
        position: fixed; inset: 0; z-index: 1;
        background: radial-gradient(ellipse at center, rgba(20,16,14,0.30) 0%, rgba(20,16,14,0.74) 100%);
      }
      .content {
        position: fixed; inset: 0; z-index: 2;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center; padding: 2rem;
      }
      .kicker {
        letter-spacing: 0.5em; text-transform: uppercase;
        font-size: clamp(0.7rem, 2vw, 0.95rem);
        opacity: 0.85; margin-bottom: 2rem; padding-left: 0.5em;
      }
      .bientot {
        font-weight: 300; line-height: 1; letter-spacing: 0.02em;
        font-size: clamp(3.4rem, 13vw, 7.5rem);
      }
      .ar {
        font-family: "Amiri", serif;
        font-size: clamp(2rem, 7vw, 3.6rem);
        margin-top: 0.5rem; opacity: 0.95;
      }
      .tag {
        font-weight: 300; line-height: 1.6; opacity: 0.9;
        font-size: clamp(1rem, 2.6vw, 1.35rem); max-width: 30rem;
        margin-top: 2.4rem;
      }
      .signup {
        margin-top: 2.4rem; width: 100%; max-width: 30rem;
        display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;
      }
      .signup input {
        flex: 1 1 15rem; min-width: 0;
        background: rgba(239, 230, 216, 0.06);
        border: 1px solid rgba(239, 230, 216, 0.35);
        color: #efe6d8; font-family: inherit; font-size: 1rem;
        padding: 0.85rem 1.1rem; border-radius: 2px; outline: none;
      }
      .signup input::placeholder { color: rgba(239, 230, 216, 0.55); }
      .signup input:focus { border-color: #b7a861; }
      .signup button {
        background: #efe6d8; color: #1c1714; border: none;
        font-family: inherit; font-size: 1rem; letter-spacing: 0.04em;
        padding: 0.85rem 1.6rem; border-radius: 2px; cursor: pointer;
        transition: background 0.2s ease;
      }
      .signup button:hover { background: #b7a861; }
      .signup button:disabled { opacity: 0.6; cursor: default; }
      .signup-msg {
        margin-top: 1rem; min-height: 1.3em;
        font-size: 0.95rem; opacity: 0.9;
      }
      .fadein { opacity: 0; animation: rise 1.6s ease forwards; }
      .fadein:nth-child(2) { animation-delay: 0.15s; }
      .fadein:nth-child(3) { animation-delay: 0.3s; }
      .fadein:nth-child(4) { animation-delay: 0.45s; }
      .fadein:nth-child(5) { animation-delay: 0.6s; }
      @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        .slide { animation: none; }
        .slide:nth-child(1) { opacity: 1; }
        .fadein { animation: none; opacity: 1; }
      }
    </style>
  </head>
  <body>
    <div class="stage" aria-hidden="true">
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
      <div class="slide"></div>
    </div>
    <div class="overlay" aria-hidden="true"></div>
    <main class="content">
      <p class="kicker fadein">Maison Reflet</p>
      <h1 class="bientot fadein">Bientôt</h1>
      <p class="ar fadein" dir="rtl" lang="ar">قريبًا</p>
      <p class="tag fadein">Six parfums, six reflets d'une identité franco-arabe.</p>
      <form class="signup fadein" id="signup">
        <input type="email" name="email" required placeholder="Votre adresse email" aria-label="Votre adresse email" />
        <button type="submit">Prévenez-moi</button>
      </form>
      <p class="signup-msg" id="signup-msg" role="status" aria-live="polite"></p>
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
          msg.textContent = "Un instant…";
          fetch("/api/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email }),
          })
            .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
              if (res.ok && res.d && res.d.ok) {
                f.style.display = "none";
                msg.textContent = "Merci. Vous serez parmi les premiers prévenus.";
              } else {
                msg.textContent = (res.d && res.d.error) || "Une erreur est survenue.";
                btn.disabled = false;
              }
            })
            .catch(function () {
              msg.textContent = "Vérifiez votre connexion et réessayez.";
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
