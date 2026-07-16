import type { APIRoute } from "astro";
import { createSubscriber } from "../../lib/sanity";
import { locales, type Locale } from "../../i18n";

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Clé PRIVÉE dédiée, distincte de KLAVIYO_PRIVATE_API_KEY (scopée Events:Write
// pour le relais /api/events) : celle-ci est scopée Subscriptions:Write
// uniquement — même principe de moindre privilège, une capacité par clé.
const KLAVIYO_SUBSCRIBE_API_KEY = import.meta.env.KLAVIYO_SUBSCRIBE_API_KEY;
// Clé Events:Write (la même que le relais /api/events) : sert ici à poser la
// langue sur le profil via recordSignupLocale() — la job d'abonnement
// ci-dessous n'accepte que email/téléphone/consentement, pas de propriétés.
const KLAVIYO_EVENTS_API_KEY = import.meta.env.KLAVIYO_PRIVATE_API_KEY;
const KLAVIYO_REVISION = "2025-04-15";
// Liste "Newsletter" (single_opt_in), créée dédiée à ce formulaire — distincte
// de "Waitlist Lancement" qui garde son usage d'origine.
const KLAVIYO_NEWSLETTER_LIST_ID = "R6AmNZ";

/** Langue du site (fr/ar/en) si valide, sinon null — optionnelle, jamais bloquante. */
function parseLocale(value: unknown): Locale | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return (locales as readonly string[]).includes(v) ? (v as Locale) : null;
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Abonne le profil à la liste Newsletter avec un vrai consentement marketing
 * (SUBSCRIBED) — sans ça, Klaviyo ne déclenche jamais "Subscribed to List" et
 * ne peut légalement/fonctionnellement rien envoyer au profil. Best effort :
 * ne doit jamais faire échouer l'inscription si Klaviyo est indisponible.
 */
async function subscribeToKlaviyo(email: string) {
  if (!KLAVIYO_SUBSCRIBE_API_KEY) {
    console.error("[subscribe] KLAVIYO_SUBSCRIBE_API_KEY absente — abonnement Klaviyo ignoré.");
    return;
  }

  const payload = {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        profiles: {
          data: [
            {
              type: "profile",
              attributes: {
                email,
                subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
              },
            },
          ],
        },
        historical_import: false,
      },
      relationships: {
        list: { data: { type: "list", id: KLAVIYO_NEWSLETTER_LIST_ID } },
      },
    },
  };

  try {
    const res = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_SUBSCRIBE_API_KEY}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[subscribe] Klaviyo a refusé l'abonnement :", res.status, detail.slice(0, 500));
    }
  } catch (error) {
    console.error("[subscribe] Klaviyo injoignable :", error);
  }
}

/**
 * Pose la langue du site (fr/ar/en) sur le profil Klaviyo, via un événement
 * "Subscribed to Newsletter" dont l'upsert de profil porte la propriété
 * personnalisée `site_locale` — prérequis des futurs emails en arabe : un
 * conditional split sur cette propriété aiguillera chaque flow vers la bonne
 * langue. Nom délibérément DIFFÉRENT de "locale" : Klaviyo réserve déjà un
 * champ système `locale` sur chaque profil (rempli automatiquement, valeur
 * observée "en" sur tous les profils du compte) — une propriété perso du
 * même nom affiché ("Locale") serait invisible dans le picker du champ
 * système au moment de construire un split, piège vécu en réel sur ce compte.
 * L'événement documente au passage l'inscription côté serveur (source, langue).
 * Best effort, comme tout le tracking.
 */
async function recordSignupLocale(email: string, locale: Locale) {
  if (!KLAVIYO_EVENTS_API_KEY) {
    console.error("[subscribe] KLAVIYO_PRIVATE_API_KEY absente — locale non enregistrée.");
    return;
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: { source: "footer", site_locale: locale },
        metric: { data: { type: "metric", attributes: { name: "Subscribed to Newsletter" } } },
        profile: {
          data: { type: "profile", attributes: { email, properties: { site_locale: locale } } },
        },
      },
    },
  };

  try {
    const res = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_EVENTS_API_KEY}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[subscribe] Klaviyo a refusé la locale :", res.status, detail.slice(0, 500));
    }
  } catch (error) {
    console.error("[subscribe] Klaviyo injoignable (locale) :", error);
  }
}

export const POST: APIRoute = async ({ request }) => {
  let email = "";
  let locale: Locale | null = null;
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.json();
      email = String(body?.email ?? "");
      locale = parseLocale(body?.locale);
    } else {
      const form = await request.formData();
      email = String(form.get("email") ?? "");
      locale = parseLocale(form.get("locale"));
    }
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400);
  }

  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: "Adresse email invalide." }, 400);
  }

  try {
    await createSubscriber(email, "teaser");
    await subscribeToKlaviyo(email);
    if (locale) await recordSignupLocale(email, locale);
    return json({ ok: true }, 200);
  } catch (error) {
    console.error("[subscribe]", error);
    return json({ ok: false, error: "Erreur serveur, réessayez." }, 500);
  }
};
