/**
 * Le montant de l'avoir annoncé sur le site : le prix pratiqué du coffret
 * découverte, plafonné à AVOIR_AED. Pendant la prévente le coffret est à 120
 * (160 barré) et l'avoir suit (Sandro, 30 oct.) ; à la fin de la prévente, le
 * prix Shopify repasse à 160 et les textes avec, sans rien retoucher.
 *
 * Les textes portent les jetons « {credit} » et « {days} » (i18n.ts) ;
 * `avecAvoir` rend une fonction de traduction qui les remplit, la durée
 * suivant l'interrupteur de prévente (150 jours, 90 ensuite). Module serveur :
 * il lit Shopify et Sanity.
 */
import { AVOIR_AED, COFFRET_HANDLE, validiteJours } from "./coffret";
import { getAllProducts, getPrimaryVariant } from "./shopify";
import { getPrevente } from "./sanity";
import type { UIKey } from "../i18n";

let montantOnce: Promise<number> | null = null;

export function montantAvoir(): Promise<number> {
  montantOnce ??= getAllProducts()
    .then((products) => {
      const coffret = products.find((p) => p.handle === COFFRET_HANDLE);
      const prix = coffret ? Number(getPrimaryVariant(coffret).price.amount) : NaN;
      return Number.isFinite(prix) && prix > 0 ? Math.min(prix, AVOIR_AED) : AVOIR_AED;
    })
    .catch(() => AVOIR_AED);
  return montantOnce;
}

export async function avecAvoir(t: (key: UIKey) => string): Promise<(key: UIKey) => string> {
  const [montant, prevente] = await Promise.all([montantAvoir().then(String), getPrevente()]);
  const jours = String(validiteJours(prevente.active));
  return (key) => t(key).replaceAll("{credit}", montant).replaceAll("{days}", jours);
}
