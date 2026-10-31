/**
 * Ce qu'un lecteur d'écran entend devant les deux prix de la prévente.
 *
 * À l'écran, le trait du prix barré suffit ; à l'oreille, « 380 AED 320 AED »
 * ne dit pas lequel est l'ancien. Les composants posent donc, en texte masqué
 * (`.sr-only`, Layout) :
 *
 *   <s data-money-compare=…><span class="sr-only">{was}</span><span data-money-amount>380 AED</span></s>
 *   <span class="sr-only sr-launch">{now}</span><span data-money=…>320 AED</span>
 *
 * `data-money-amount` est la seule partie que l'hydratation des prix réécrit
 * (lib/country.ts) ; `.sr-launch` disparaît avec le prix barré (Layout).
 */
import { defaultLocale, locales, useTranslations, type Locale } from "../i18n";

/** `lang` : la langue de la page, ou `Astro.params.lang` tel quel pour un composant qui ne la reçoit pas. */
export function priceA11y(param: Locale | string | undefined): { was: string; now: string } {
  const lang = (locales as readonly string[]).includes(param ?? "") ? (param as Locale) : defaultLocale;
  const t = useTranslations(lang);
  // Espace insécable avant les deux-points en français, pas ailleurs.
  const colon = lang === "fr" ? "\u00a0: " : ": ";
  return { was: `${t("prevente.was")}${colon}`, now: `${t("prevente.launchPrice")}${colon}` };
}
