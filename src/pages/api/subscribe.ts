import type { APIRoute } from "astro";
import { createSubscriber } from "../../lib/sanity";

/*
 * Langues du site, en dur : cette branche (prod, mode page d'attente) n'a pas
 * encore le module src/i18n.ts du site trilingue. À remplacer par l'import
 * depuis ce module le jour de la fusion.
 */
const locales = ["fr", "ar", "en"] as const;
type Locale = (typeof locales)[number];

// Rendu à la demande (fonction serverless Vercel), pas prégénéré.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Clé PRIVÉE dédiée, distincte de KLAVIYO_PRIVATE_API_KEY (scopée Events:Write
// pour le relais /api/events) — même principe de moindre privilège, une
// capacité par clé. Scopes RÉELLEMENT requis (vérifié en réel, l'API rejette
// sinon en 403 "missing required scopes") : Subscriptions:Write ET
// Profiles:Write ET Lists:Write — le job touche aux trois ressources, pas
// seulement au statut d'abonnement.
const KLAVIYO_SUBSCRIBE_API_KEY = import.meta.env.KLAVIYO_SUBSCRIBE_API_KEY;
// Clé Events:Write (la même que le relais /api/events) : sert ici à poser la
// langue sur le profil via recordSignupLocale() — la job d'abonnement
// ci-dessous n'accepte que email/téléphone/consentement, pas de propriétés.
const KLAVIYO_EVENTS_API_KEY = import.meta.env.KLAVIYO_PRIVATE_API_KEY;
const KLAVIYO_REVISION = "2025-04-15";
// Liste "Newsletter" (single_opt_in), créée dédiée à ce formulaire — distincte
// de "Waitlist Lancement" qui garde son usage d'origine.
const KLAVIYO_NEWSLETTER_LIST_ID = "R6AmNZ";

/**
 * Formulaire d'origine ("teaser", "footer"…). Sert à la fois de `source` sur
 * le document Sanity et de propriété d'événement Klaviyo. Défaut "teaser" :
 * c'est l'appelant historique, qui n'envoyait rien.
 */
function parseSource(value: unknown): string {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9_-]{1,24}$/.test(v) ? v : "teaser";
}

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
 * ne peut légalement/fonctionnellement rien envoyer au profil.
 *
 * Renvoie vrai si l'abonnement est passé : l'appelant s'en sert pour décider
 * s'il reste au moins un enregistrement de l'email avant de répondre OK.
 */
async function subscribeToKlaviyo(email: string): Promise<boolean> {
  if (!KLAVIYO_SUBSCRIBE_API_KEY) {
    console.error("[subscribe] KLAVIYO_SUBSCRIBE_API_KEY absente — abonnement Klaviyo ignoré.");
    return false;
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
      return false;
    }
    return true;
  } catch (error) {
    console.error("[subscribe] Klaviyo injoignable :", error);
    return false;
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
async function recordSignupLocale(email: string, locale: Locale, source: string) {
  if (!KLAVIYO_EVENTS_API_KEY) {
    console.error("[subscribe] KLAVIYO_PRIVATE_API_KEY absente — locale non enregistrée.");
    return;
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: { source, site_locale: locale },
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
  let source = "teaser";
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.json();
      email = String(body?.email ?? "");
      locale = parseLocale(body?.locale);
      source = parseSource(body?.source);
    } else {
      const form = await request.formData();
      email = String(form.get("email") ?? "");
      locale = parseLocale(form.get("locale"));
      source = parseSource(form.get("source"));
    }
  } catch {
    return json({ ok: false, error: "Requête invalide." }, 400);
  }

  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: "Adresse email invalide." }, 400);
  }

  /*
   * Les deux enregistrements partent EN PARALLÈLE et chacun encaisse son
   * propre échec. Ils étaient enchaînés, Sanity d'abord : un token d'écriture
   * Sanity manquant levait une exception AVANT l'appel à Klaviyo, donc
   * l'email n'arrivait ni dans l'un ni dans l'autre et le visiteur recevait
   * une erreur serveur. Klaviyo est le système de référence pour l'emailing,
   * il n'a pas à dépendre d'un journal de confort.
   */
  const [sanity, klaviyo] = await Promise.allSettled([
    createSubscriber(email, source),
    subscribeToKlaviyo(email),
  ]);
  const sanityOk = sanity.status === "fulfilled";
  const klaviyoOk = klaviyo.status === "fulfilled" && klaviyo.value;
  if (!sanityOk) console.error("[subscribe] écriture Sanity échouée :", sanity.reason);

  // On ne renvoie une erreur que si l'email n'a été retenu NULLE PART : sinon
  // le visiteur verrait un échec alors qu'il est bien inscrit.
  if (!sanityOk && !klaviyoOk) {
    return json({ ok: false, error: "Erreur serveur, réessayez." }, 500);
  }

  if (locale) await recordSignupLocale(email, locale, source);
  return json({ ok: true }, 200);
};
