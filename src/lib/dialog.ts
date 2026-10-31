/**
 * Tiroirs et feuilles modales : ce qui doit se passer au clavier, partout pareil.
 *
 * Fermé, un tiroir est `inert` (hors de l'ordre de tabulation, hors de l'arbre
 * d'accessibilité) en plus d'`aria-hidden` ; ouvert, le focus entre dedans,
 * Tab et Maj+Tab y tournent en boucle, et à la fermeture il revient à
 * l'élément qui l'avait ouvert. Même mécanique que le tiroir panier
 * (CartDrawer), qui l'a eue le premier.
 */

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Éléments atteignables au clavier dans `root`, dans l'ordre du DOM, visibles seulement. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
    (el) => !el.hidden && !el.closest("[inert]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
  );
}

/**
 * Garde Tab dans `root` : à appeler depuis un `keydown` quand le tiroir est
 * ouvert. Un focus égaré hors du tiroir (clic sur le voile, par exemple) y
 * revient au prochain Tab.
 */
export function trapTab(root: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== "Tab") return;
  const list = focusables(root);
  if (!list.length) {
    e.preventDefault();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (!active || !root.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Ouvert ou fermé pour le clavier et les lecteurs d'écran (la classe visuelle reste à l'appelant). */
export function setDialogOpen(drawer: HTMLElement, open: boolean): void {
  drawer.inert = !open;
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
}

/**
 * Rend le focus à l'élément qui avait ouvert le tiroir. S'il n'est plus
 * atteignable (bouton de la feuille du menu mobile ou du panneau Parfums,
 * refermés entre-temps pour laisser passer le tiroir), c'est le bouton qui
 * commande ce conteneur (`aria-controls`) qui le reprend : le bouton menu, le
 * lien « Parfums ».
 */
export function restoreFocus(el: HTMLElement | null): void {
  const usable = (x: HTMLElement | null): x is HTMLElement =>
    Boolean(x && x !== document.body && x.isConnected && !x.closest("[inert]") && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== "hidden");
  if (usable(el)) return el.focus();
  for (let box = el?.parentElement?.closest<HTMLElement>("[id]"); box; box = box.parentElement?.closest<HTMLElement>("[id]")) {
    const commande = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(box.id)}"]`);
    if (usable(commande)) return commande.focus();
  }
}
