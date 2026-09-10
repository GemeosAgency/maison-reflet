import type { APIRoute } from "astro";
import { locales, type Locale } from "../../../i18n";
import { COUNTRY_COOKIE, getCountry, isShippedCountry } from "../../../lib/markets";
import { syncLumaEmail } from "../../../lib/luma/klaviyo";
import { findProduct } from "../../../lib/luma/knowledge";
import { getKnowledge } from "../../../lib/luma/knowledge-live";
import { latestProfile, logEvent, setSessionEmail, visitorOf } from "../../../lib/luma/store";

export const prerender = false;

/**
 * L'email que le visiteur donne à Luma (brief §3.2 `/api/luma/profile`).
 *
 * Il est posé sur la session vivante, puis synchronisé vers Klaviyo (voir
 * src/lib/luma/klaviyo.ts) : un événement « Luma Sheet Requested » qui porte le
 * Reflet recommandé — c'est lui qui déclenchera l'envoi de la fiche — et, si la
 * case est cochée, l'abonnement à la newsletter. Sans consentement : un profil,
 * pas d'abonnement (brief §4). Klaviyo est « best effort » : l'email est déjà en
 * base, on répond OK au visiteur même si Klaviyo tousse, et le journal garde le
 * résultat. Sans cookie de session, rien à rattacher : on refuse.
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

    const cookieCountry = cookies.get(COUNTRY_COOKIE)?.value;
    const country = getCountry(
      isShippedCountry(cookieCountry) ? cookieCountry : request.headers.get("x-vercel-ip-country")
    );

    // Le profil (Reflet recommandé, signaux) et le catalogue (cache) se lisent
    // pendant que l'email s'écrit : rien ne dépend de l'autre.
    const [profile, knowledge] = await Promise.all([
      latestProfile({ ...visitor, email }),
      getKnowledge({ country: country.code, locale }),
      setSessionEmail(session.id, email),
    ]);
    const product = profile.recommended ? (findProduct(knowledge, profile.recommended) ?? null) : null;
    const alternative = profile.alternative ? (findProduct(knowledge, profile.alternative) ?? null) : null;

    const klaviyo = await syncLumaEmail({
      email,
      consent,
      locale,
      country: country.code,
      origin: new URL(request.url).origin,
      sessionId: session.id,
      profile,
      product,
      alternative,
    });
    await logEvent(session.id, "email_captured", { consent, locale, klaviyo });
    return json({ ok: true }, 200);
  } catch (error) {
    console.error("[luma/profile] échec :", error);
    return json({ ok: false, error: "Erreur serveur, réessayez." }, 500);
  }
};
