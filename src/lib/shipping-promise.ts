/**
 * Promesse de livraison affichée dans la page, pour le pays sélectionné.
 *
 * Un seul rendu pour tous les emplacements : le tiroir pays, la fiche produit,
 * le panier. Chaque emplacement n'est que du balisage marqué
 * `[data-shipping-promise]` (voir ShippingPromise.astro) ; c'est ce module qui
 * les remplit, les remet à jour sur `country:changed`, et fait battre le compte
 * à rebours de Dubaï.
 *
 * Les libellés viennent du blob `#region-i18n` émis par CountryDrawer, monté
 * une seule fois dans le layout : les trois langues restent traduites côté
 * serveur, le navigateur ne fait que remplir les jetons.
 */

import {
  DELIVERY_DAYS,
  UAE_DELIVERY_DAYS,
  countryName,
  formatMoney,
  freeShippingThreshold,
  sameDayStatus,
  shippingRate,
  type Country,
} from "./markets";
import { getActiveCurrency, pageLocale, selectedCountry } from "./country";

export type RegionI18n = Record<string, string>;

let strings: RegionI18n = {};
let ticker: number | undefined;

function t(key: string, tokens: Record<string, string | number> = {}): string {
  let out = strings[key] ?? "";
  for (const [name, value] of Object.entries(tokens)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

/** « 3 h 42 min » au-delà d'une heure, « 42 min 12 s » en dessous. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? t("shipping.countdownHM", { h, m }) : t("shipping.countdownMS", { m, s });
}

type Promise2Lines = { main: string; sub: string; urgent: boolean };

/** Les deux lignes de la promesse, pour un pays donné. */
export function promiseFor(country: Country): Promise2Lines {
  const locale = pageLocale();
  const days = DELIVERY_DAYS[country.group];
  // Le DÉLAI vient des zones de livraison Shopify (les 28 pays sont bien
  // servis) ; les MONTANTS, eux, sont dans la devise que Shopify pratique
  // vraiment pour ce pays — les deux ne bougent pas ensemble.
  const currency = getActiveCurrency();
  const rate = formatMoney(shippingRate(country.zone, currency), currency, locale);
  const free = formatMoney(freeShippingThreshold(currency), currency, locale);
  const freeFrom = t("shipping.freeFrom", { amount: free });

  // Émirats : Dubaï le jour même avant 14 h, le reste sur le délai standard.
  // C'est la seule promesse qui bouge au fil de la journée, d'où le rebours.
  if (country.zone === "domestic") {
    const sameDay = sameDayStatus();
    return {
      main: sameDay.open
        ? t("shipping.sameDayOpen", { time: formatCountdown(sameDay.msLeft) })
        : t("shipping.sameDayClosed"),
      sub: `${t("shipping.restOfUae", {
        min: UAE_DELIVERY_DAYS.min,
        max: UAE_DELIVERY_DAYS.max,
      })} · ${rate}, ${freeFrom}`,
      urgent: sameDay.open,
    };
  }

  return {
    main: t("shipping.toCountry", { country: countryName(country.code, locale) }),
    sub: `${t("shipping.days", { min: days.min, max: days.max })} · ${rate}, ${freeFrom}`,
    urgent: false,
  };
}

/** Remplit tous les emplacements présents dans `root`. */
export function renderShippingPromises(root: ParentNode = document): void {
  const country = selectedCountry();
  const { main, sub, urgent } = promiseFor(country);

  for (const el of root.querySelectorAll<HTMLElement>("[data-shipping-promise]")) {
    const mainEl = el.querySelector<HTMLElement>("[data-ship-main]");
    const subEl = el.querySelector<HTMLElement>("[data-ship-sub]");
    if (mainEl) mainEl.textContent = main;
    // Certains emplacements (fiche produit) ne montrent que la ligne principale.
    if (subEl) subEl.textContent = sub;
    el.classList.toggle("is-urgent", urgent);
  }
}

/**
 * Démarre le rendu et, aux Émirats seulement, le battement du rebours.
 *
 * La seconde est la bonne granularité : sous une heure le libellé affiche les
 * secondes, et au-dessus, réécrire la même minute soixante fois ne coûte qu'un
 * `textContent` — bien moins qu'un timer à géométrie variable à maintenir.
 * Le battement s'arrête dès que la page passe en arrière-plan.
 */
export function initShippingPromises(i18n: RegionI18n): void {
  strings = i18n;
  renderShippingPromises();

  const stop = () => {
    if (ticker !== undefined) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };

  const start = () => {
    stop();
    if (selectedCountry().zone !== "domestic") return;
    if (!document.querySelector("[data-shipping-promise]")) return;
    ticker = window.setInterval(() => renderShippingPromises(), 1000);
  };

  start();
  document.addEventListener("country:changed", () => {
    renderShippingPromises();
    start();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else {
      renderShippingPromises();
      start();
    }
  });
}
