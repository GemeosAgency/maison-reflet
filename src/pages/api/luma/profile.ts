import type { APIRoute } from "astro";
import { locales, type Locale } from "../../../i18n";
import { logEvent, setSessionEmail, visitorOf } from "../../../lib/luma/store";

export const prerender = false;

/**
 * L'email que le visiteur donne à Luma (brief §3.2 `/api/luma/profile`).
 *
 * v1 : il est posé sur la session vivante, avec le consentement marketing tel
 * que coché — un profil est créé SANS souscription par défaut (brief §4) ; la
 * synchronisation Klaviyo (propriétés `luma_*`, événements) viendra à l'étape
 * 8. Sans cookie de session, rien à rattacher : on refuse.
 */

const SESSION_COOKIE = "mr_luma";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request)) return json({ ok: false, error: "Origine refusée." }, 403);

  const anonId = cookies.get(SESSION_COOKIE)?.value;
  if (!anonId) return json({ ok: false, error: "Pas de conversation en cours." }, 400);

  let email = "";
  let consent = false;
  let locale: Locale = "fr";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    consent = body?.consent === true;
    const l = String(body?.locale ?? "").toLowerCase();
    if ((locales as readonly string[]).includes(l)) locale = l as Locale;
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: "Adresse email invalide." }, 400);

  try {
    const visitor = await visitorOf(anonId, locale);
    const session = visitor.live ?? null;
    if (!session) return json({ ok: false, error: "Pas de conversation en cours." }, 400);
    await setSessionEmail(session.id, email);
    await logEvent(session.id, "email_captured", { consent, locale });
    return json({ ok: true }, 200);
  } catch (error) {
    console.error("[luma/profile] échec :", error);
    return json({ ok: false, error: "Erreur serveur, réessayez." }, 500);
  }
};
