/**
 * Le montant de l'avoir annoncé sur le site : le prix pratiqué du coffret
 * découverte, plafonné à AVOIR_AED. Pendant la prévente le coffret est à 120
 * (160 barré) et l'avoir suit (Sandro, 30 oct.) ; à la fin de la prévente, le
 * prix Shopify repasse à 160 et les textes avec, sans rien retoucher.
 *
 * Les textes portent le jeton « {credit} » (i18n.ts) ; `avecAvoir` rend une
 * fonction de traduction qui le remplit. Module serveur : il lit Shopify.
 */
import { AVOIR_AED, COFFRET_HANDLE } from "./coffret";
import { getAllProducts, getPrimaryVariant } from "./shopify";
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
  const montant = String(await montantAvoir());
  return (key) => t(key).replaceAll("{credit}", montant);
}
