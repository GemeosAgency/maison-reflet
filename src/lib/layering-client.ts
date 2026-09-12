/**
 * « Ajouter les deux » : le bouton d'un accord ajoute les deux flacons au
 * panier en une mutation (addManyToCart, suivi normal). Partagé entre la fiche
 * (LayeringBlock) et la page guide ; `data-bound` évite de câbler deux fois
 * quand plusieurs composants appellent bindLayeringAdds sur la même page.
 */
import { addManyToCart } from "./cart";

export function bindLayeringAdds(root: ParentNode = document): void {
  for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-layering-add]")) {
    if (btn.dataset.bound) continue;
    btn.dataset.bound = "1";
    btn.addEventListener("click", async () => {
      const ids = (btn.dataset.variants ?? "").split(",").filter(Boolean);
      const label = btn.querySelector<HTMLElement>("[data-layering-label]");
      const initial = label?.textContent ?? "";
      if (!ids.length) return;
      btn.disabled = true;
      try {
        await addManyToCart(ids.map((variantId) => ({ variantId, quantity: 1 })));
        if (label) label.textContent = btn.dataset.addedLabel ?? initial;
      } catch {
        if (label) label.textContent = btn.dataset.errorLabel ?? initial;
      } finally {
        btn.disabled = false;
        window.setTimeout(() => {
          if (label) label.textContent = initial;
        }, 1800);
      }
    });
  }
}
