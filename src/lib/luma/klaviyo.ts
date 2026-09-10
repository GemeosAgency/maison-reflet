/**
 * Klaviyo, côté Luma — première pierre de l'étape 8 du brief (11 septembre 2026).
 * Serveur uniquement : clés privées, jamais dans le navigateur.
 *
 * Réponse à la question de Sandro « où vont ces emails ? » : jusqu'ici, en base
 * seulement (luma_sessions.email). Désormais, à chaque email donné à Luma :
 *  1. un événement sur le profil Klaviyo (créé s'il n'existe pas), qui porte le
 *     Reflet recommandé en propriétés et pose les signaux `luma_*` sur le
 *     profil (brief §10). C'est cet événement qui déclenchera le flow « fiche »
 *     côté Klaviyo : « Luma Sheet Requested » quand un Reflet a été recommandé,
 *     « Luma Email Captured » sinon. Tant que le flow n'existe pas, l'événement
 *     s'accumule sur le profil — rien ne part, rien ne se perd ;
 *  2. si — et seulement si — la case est cochée : abonnement marketing à la
 *     liste Newsletter (single opt-in, même liste que le pied de page). Sans
 *     consentement, le profil existe mais ne reçoit que ce qu'il a demandé.
 *
 * Tout est « best effort » : l'email est déjà en base quand on arrive ici, et
 * Klaviyo ne doit jamais faire échouer la réponse au visiteur. Le résultat est
 * rendu à l'appelant pour le journal.
 */

import type { Locale } from "../../i18n";
import type { KnowledgeProduct } from "./knowledge";
import type { VisitContext } from "./persona";

const REVISION = "2025-04-15";
// Même liste que le formulaire du pied de page (src/pages/api/subscribe.ts).
const NEWSLETTER_LIST_ID = "R6AmNZ";
export const SHEET_METRIC = "Luma Sheet Requested";
export const CAPTURE_METRIC = "Luma Email Captured";

function env(name: string): string | undefined {
  return (
    (typeof process !== "undefined" ? process.env[name] : undefined) ??
    (import.meta.env as Record<string, string | undefined> | undefined)?.[name]
  );
}

export type LumaSyncInput = {
  email: string;
  consent: boolean;
  locale: Locale;
  country: string;
  /** Origine du site qui répond (staging ou production) : sert aux liens de la fiche. */
  origin: string;
  sessionId: string;
  profile: NonNullable<VisitContext["profile"]>;
  product: KnowledgeProduct | null;
  alternative: KnowledgeProduct | null;
};

export type LumaSyncResult = { metric: string; event: boolean; subscribed: boolean | null };

async function post(path: string, key: string, payload: unknown, what: string): Promise<boolean> {
  try {
    const res = await fetch(`https://a.klaviyo.com/api/${path}`, {
      method: "POST",
      headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: REVISION, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[luma/klaviyo] ${what} refusé :`, res.status, detail.slice(0, 500));
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[luma/klaviyo] ${what} injoignable :`, error);
    return false;
  }
}

/** Sans les champs vides : Klaviyo n'a pas besoin de propriétés à null. */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ""));
}

export async function syncLumaEmail(input: LumaSyncInput): Promise<LumaSyncResult> {
  const eventsKey = env("KLAVIYO_PRIVATE_API_KEY");
  const subscribeKey = env("KLAVIYO_SUBSCRIBE_API_KEY");
  const { product, alternative, profile } = input;
  const main = product?.variants.find((v) => !v.sample) ?? product?.variants[0];
  const urlOf = (p: KnowledgeProduct) =>
    `${input.origin}/${input.locale}/${p.kind === "coffret" ? "coffrets" : "parfums"}/${p.handle}`;
  const metric = product ? SHEET_METRIC : CAPTURE_METRIC;

  const properties = compact({
    Source: "luma",
    Locale: input.locale,
    Country: input.country,
    Consent: input.consent,
    ProductName: product?.name,
    ProductHandle: product?.handle,
    ProductURL: product ? urlOf(product) : null,
    ImageURL: product?.image,
    Price: main?.price,
    Currency: main?.currency,
    AlternativeName: alternative?.name,
    AlternativeURL: alternative ? urlOf(alternative) : null,
  });
  // `site_locale` : la propriété que les flows utilisent déjà pour la langue (voir subscribe.ts).
  const profileProperties = compact({
    site_locale: input.locale,
    luma_recommended: product?.name,
    luma_alternative: alternative?.name,
    luma_cited_origin: profile.citedOrigin,
    luma_for_whom: profile.forWhom,
    luma_occasion: profile.occasion,
    luma_wears_today: profile.wearsToday,
    luma_consent: input.consent,
    luma_last_seen: new Date().toISOString(),
  });

  let event = false;
  if (!eventsKey) {
    console.error("[luma/klaviyo] KLAVIYO_PRIVATE_API_KEY absente — événement ignoré.");
  } else {
    event = await post(
      "events/",
      eventsKey,
      {
        data: {
          type: "event",
          attributes: {
            properties,
            // Un même Reflet demandé deux fois dans la même session ne fait qu'un événement.
            unique_id: `luma:${input.sessionId}:${metric}:${product?.handle ?? "none"}`,
            metric: { data: { type: "metric", attributes: { name: metric } } },
            profile: { data: { type: "profile", attributes: { email: input.email, properties: profileProperties } } },
          },
        },
      },
      `événement « ${metric} »`
    );
  }

  let subscribed: boolean | null = null;
  if (input.consent) {
    if (!subscribeKey) {
      console.error("[luma/klaviyo] KLAVIYO_SUBSCRIBE_API_KEY absente — abonnement ignoré.");
      subscribed = false;
    } else {
      subscribed = await post(
        "profile-subscription-bulk-create-jobs/",
        subscribeKey,
        {
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [
                  {
                    type: "profile",
                    attributes: { email: input.email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } },
                  },
                ],
              },
              historical_import: false,
            },
            relationships: { list: { data: { type: "list", id: NEWSLETTER_LIST_ID } } },
          },
        },
        "abonnement newsletter"
      );
    }
  }

  return { metric, event, subscribed };
}
