/**
 * Ce qu'on affiche quand une lecture échoue.
 *
 * Avant, les fonctions de chargement rattrapaient l'erreur et rendaient une
 * liste vide : une panne Supabase ressemblait à une journée sans vente. Un
 * tableau de bord qui ment est pire qu'un tableau de bord en panne. Maintenant
 * la lecture lève, la page attrape, et on dit ce qui s'est passé.
 */
const ECHAPPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ECHAPPE[c]);

/** Le message utile, sans la plomberie ni la clé de service. */
function message(erreur: unknown): string {
  const brut = erreur instanceof Error ? erreur.message : String(erreur);
  return brut.replace(/\[admin\/[a-z]+\]\s*/i, "").replace(/eyJ[\w-]{20,}/g, "…").slice(0, 300);
}

/**
 * Rend la page de panne. Retour direct depuis le frontmatter :
 *
 *     try { b = await business(range, filters); }
 *     catch (e) { return panne(e, "Ventes", Astro.url); }
 */
export function panne(erreur: unknown, page: string, url: URL): Response {
  console.error(`[admin/${page}]`, erreur);
  const texte = message(erreur);
  const trop = /plus de \d+ lignes/.test(texte);
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(page)} — données indisponibles</title>
<style>
  @font-face { font-family: "PP Neue Montreal"; src: url("/fonts/ppneuemontreal-book.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "PP Neue Montreal"; src: url("/fonts/ppneuemontreal-medium.woff2") format("woff2"); font-weight: 500; font-display: swap; }
  :root { --rose: #812538; --ink: #150e0a; --bg: #f1eee9; --paper: #f7f5f2; --line: rgba(21,14,10,.12); --muted: rgba(21,14,10,.6); }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
         background: var(--bg); color: var(--ink);
         font: 15px/1.6 "PP Neue Montreal", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .carte { max-width: 33rem; width: 100%; background: var(--paper); border: 1px solid var(--line);
           border-radius: 14px; padding: 32px; }
  .oeil { display: inline-block; font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
          color: var(--rose); margin-bottom: 14px; }
  h1 { margin: 0 0 12px; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; }
  p { margin: 0 0 14px; color: var(--muted); }
  pre { margin: 0 0 20px; padding: 12px 14px; background: rgba(21,14,10,.05); border-radius: 9px;
        font-size: 12.5px; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
  .liens { display: flex; gap: 10px; flex-wrap: wrap; }
  a { display: inline-block; padding: 9px 16px; border-radius: 999px; text-decoration: none; font-size: 14px; }
  .plein { background: var(--rose); color: var(--paper); }
  .vide { border: 1px solid var(--line); color: var(--ink); }
</style></head>
<body><main class="carte">
  <span class="oeil">${esc(page)}</span>
  <h1>Les données n'ont pas pu être lues.</h1>
  <p>${trop ? "La période demandée dépasse ce qu'on sait agréger d'un coup. Les chiffres affichés seraient faux, donc on ne les affiche pas." : "Rien n'est perdu : c'est la lecture qui a échoué, pas les données. Réessaie dans un instant."}</p>
  <pre>${esc(texte)}</pre>
  <div class="liens">
    <a class="plein" href="${esc(url.pathname + url.search)}">Réessayer</a>
    ${trop ? '<a class="vide" href="?days=30">Revenir à 30 jours</a>' : ""}
    <a class="vide" href="/admin">Vue d'ensemble</a>
  </div>
</main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
