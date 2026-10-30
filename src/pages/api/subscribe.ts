import type { APIRoute } from "astro";
import { locales, type Locale } from "../../i18n";

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
/*
 * Liste d'atterrissage, selon le formulaire d'origine — les deux sont en
 * single_opt_in, donc le consentement a la même valeur de part et d'autre.
 *
 *  - la page d'attente alimente "Waitlist Lancement" : ce sont des gens qui
 *    s'inscrivent pour être prévenus du lancement, pas pour une newsletter ;
 *  - le formulaire du pied de page continue d'alimenter "Newsletter" ;
 *  - « Être prévenu au lancement » de la fiche (NotifyLaunch) alimente
 *    "Prévente · Notify me" : les prospects de la prévente, nourris jusqu'au
 *    lancement (Sandro, 30 oct.).
 *
 * Toute autre provenance retombe sur "Newsletter".
 */
const KLAVIYO_LISTS: Record<string, string> = {
  teaser: "RvF9tD", // Waitlist Lancement
  footer: "R6AmNZ", // Newsletter
  notify: "YipVGU", // Prévente · Notify me
};
const KLAVIYO_LIST_PAR_DEFAUT = KLAVIYO_LISTS.footer;

function klaviyoListId(source: string): string {
  return KLAVIYO_LISTS[source] ?? KLAVIYO_LIST_PAR_DEFAUT;
}

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
async function subscribeToKlaviyo(email: string, source: string): Promise<boolean> {
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
        list: { data: { type: "list", id: klaviyoListId(source) } },
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

/** Handle Shopify du parfum demandé (« ultra-cuir »), ou null. */
function parseHandle(value: unknown): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,64}$/.test(v) ? v : null;
}

/** Chemin de la fiche (« /en/parfums/ultra-cuir »), jamais une adresse externe. */
function parsePath(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return /^\/[a-z0-9/_-]{0,120}$/i.test(v) ? v : null;
}

/**
 * Garde le parfum demandé : un événement « Notify Me Requested » par demande.
 * C'est lui qui permet, le jour du lancement, d'écrire à chacun pour le bon
 * parfum (un segment Klaviyo par `handle`). Un événement plutôt qu'une
 * propriété de profil : une même personne peut demander plusieurs parfums,
 * une propriété garderait seulement le dernier.
 */
async function recordNotifyRequest(email: string, handle: string, path: string | null, locale: Locale | null, origin: string) {
  if (!KLAVIYO_EVENTS_API_KEY) {
    console.error("[subscribe] KLAVIYO_PRIVATE_API_KEY absente — demande de lancement non enregistrée.");
    return;
  }
  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: { handle, product_url: path ? `${origin}${path}` : null, site_locale: locale },
        unique_id: `notify-${handle}-${email}`,
        metric: { data: { type: "metric", attributes: { name: "Notify Me Requested" } } },
        profile: {
          data: { type: "profile", attributes: { email, ...(locale ? { properties: { site_locale: locale } } : {}) } },
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
      console.error("[subscribe] Klaviyo a refusé la demande de lancement :", res.status, detail.slice(0, 500));
    }
  } catch (error) {
    console.error("[subscribe] Klaviyo injoignable (demande de lancement) :", error);
  }
}

export const POST: APIRoute = async ({ request, url }) => {
  let email = "";
  let locale: Locale | null = null;
  let source = "teaser";
  let handle: string | null = null;
  let path: string | null = null;
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.json();
      email = String(body?.email ?? "");
      locale = parseLocale(body?.locale);
      source = parseSource(body?.source);
      handle = parseHandle(body?.handle);
      path = parsePath(body?.url);
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
   * Klaviyo est le SEUL système d'enregistrement des inscrits : le double
   * stockage dans Sanity a été retiré le 10 septembre 2026, on se réfère à
   * Klaviyo pour tout ce qui est email.
   */
  const abonne = await subscribeToKlaviyo(email, source);
  if (!abonne) {
    return json({ ok: false, error: "Erreur serveur, réessayez." }, 500);
  }

  if (source === "notify" && handle) {
    await recordNotifyRequest(email, handle, path, locale, url.origin);
  } else if (locale) {
    await recordSignupLocale(email, locale, source);
  }
  return json({ ok: true }, 200);
};
