/**
 * Les deux effets d'attente de Luma (libraries.dev), montés depuis le script
 * vanilla du widget : pas d'intégration React dans Astro, juste react-dom sur
 * deux nœuds. Ce module est importé à la demande (ouverture du panneau) : une
 * page où Luma reste fermée ne charge pas React.
 *
 * - l'orbe (`thinking-orbs`, état `breathing`, 20 px) remplace les trois points
 *   à côté de « Luma réfléchit » ;
 * - le faisceau (`border-beam`, `md`, mono) fait le tour du champ tant que la
 *   réponse n'est pas arrivée (4 à 7 s mesurées : au-delà du seuil de 3 s).
 *   Mono sur fond papier, c'est un murmure : voulu. `colorful` a été essayé,
 *   arc-en-ciel pastel, hors charte.
 *
 * Thème clair partout : le panneau est sur fond papier.
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThinkingOrb } from "thinking-orbs";
import { BorderBeam } from "border-beam";

/** Monte l'orbe dans `host` ; renvoie de quoi la démonter. */
export function mountOrb(host: HTMLElement): () => void {
  const root = createRoot(host);
  // Le texte voisin dit déjà ce qui se passe (et la zone role="status" l'annonce).
  root.render(createElement(ThinkingOrb, { state: "breathing", size: 20, theme: "light", "aria-hidden": "true" }));
  return () => root.unmount();
}

/**
 * Le faisceau vit dans un calque posé sur le champ (`host`, en position absolue,
 * sans clic) : le champ lui-même reste dans le HTML statique du widget. Le
 * premier enfant porte le rayon du champ, que BorderBeam lit pour ses coins.
 */
export function mountBeam(host: HTMLElement): (active: boolean) => void {
  const root: Root = createRoot(host);
  const fill = { width: "100%", height: "100%" };
  return (active) =>
    root.render(
      createElement(BorderBeam, {
        size: "md",
        colorVariant: "mono",
        theme: "light",
        active,
        style: fill,
        children: createElement("div", { style: { ...fill, borderRadius: 4 } }),
      }),
    );
}
