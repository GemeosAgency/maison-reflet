import type { APIRoute } from "astro";
import { locales, type Locale } from "../../../i18n";
import { loadHistory, visitorOf } from "../../../lib/luma/store";

export const prerender = false;

/**
 * La conversation en cours, pour la ré-afficher après un changement de page.
 *
 * Décision de Sandro (11 septembre 2026) : la discussion suit la session, elle
 * ne repart pas à zéro à chaque page. Le widget garde lui-même le fil complet
 * (fiches, réponses toutes faites) le temps de l'onglet ; cette route est le
 * secours d'un NOUVEL onglet sur la même session (cookie) : le texte seul, tel
 * que la base l'a — c'est aussi ce que le modèle relit, donc rien n'y manque
 * pour continuer. Sans cookie ou sans session vivante (six heures) : liste
 * vide, jamais d'erreur au visiteur.
 */

const SESSION_COOKIE = "mr_luma";

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async ({ cookies, url }) => {
  const empty = { ok: true, messages: [] as { role: string; content: string }[], email: false };
  const anonId = cookies.get(SESSION_COOKIE)?.value;
  if (!anonId) return json(empty, 200);

  const l = (url.searchParams.get("locale") ?? "").toLowerCase();
  const locale: Locale = (locales as readonly string[]).includes(l) ? (l as Locale) : "fr";

  try {
    const visitor = await visitorOf(anonId, locale);
    if (!visitor.live) return json(empty, 200);
    const history = await loadHistory(visitor.live.id);
    return json(
      {
        ok: true,
        messages: history.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })),
        email: Boolean(visitor.live.email),
      },
      200
    );
  } catch (error) {
    console.error("[luma/history] échec :", error);
    return json({ ...empty, ok: false }, 500);
  }
};
