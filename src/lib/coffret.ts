/**
 * L'avoir du coffret découverte.
 *
 * La règle, en une phrase : qui achète le coffret (160 AED) reçoit 160 AED à
 * valoir sur un flacon. Le client ne choisit donc plus entre essayer et acheter,
 * il avance une partie de son flacon — et la découverte devient gratuite s'il
 * achète ensuite.
 *
 * Ce n'est pas une remise : le prix du flacon ne bouge jamais, ce qui permet de
 * lever le risque sans abîmer le positionnement (Kapferer : le prix est un
 * signal, on ne le brade pas).
 *
 * Deux bornes, sans lesquelles l'avoir devient un rabais permanent :
 *  - il expire (VALIDITE_JOURS), assez long pour porter les six échantillons,
 *    assez court pour créer l'élan ;
 *  - il ne s'applique qu'aux flacons, jamais à un autre coffret, sinon on
 *    financerait l'achat du coffret suivant.
 */

/** Le montant de l'avoir, en AED : exactement le prix du coffret. */
export const AVOIR_AED = 160;

/** Le prix plancher d'utilisation : un flacon. */
export const MINIMUM_AED = 320;

export const VALIDITE_JOURS = 90;

/** Le handle Shopify du coffret qui déclenche l'avoir. */
export const COFFRET_HANDLE = "sample-box";

/** Les Reflets sur lesquels l'avoir est utilisable. */
export const REFLETS = [
  "ultra-cuir",
  "minuit-bourbon",
  "new-oud",
  "bois-alert",
  "melting-mango",
  "fifth-season",
] as const;

/**
 * Le code envoyé au client. Il est dérivé du numéro de commande, donc stable :
 * Shopify rejoue ses webhooks jusqu'à 19 fois sur 48 h, et un code dérivé nous
 * évite d'émettre dix-neuf avoirs pour une seule commande. Le sel empêche de
 * deviner le code d'un voisin à partir du sien.
 */
export function codeAvoir(orderId: number | string, sel: string): string {
  let h = 0;
  for (const c of `${orderId}:${sel}`) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  const base = Math.abs(h).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `REFLET${base}`;
}

export function finValidite(depuis = new Date()): Date {
  const d = new Date(depuis);
  d.setDate(d.getDate() + VALIDITE_JOURS);
  return d;
}
