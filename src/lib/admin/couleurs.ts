/**
 * Une couleur par Reflet, dans la tour de contrôle.
 *
 * La teinte vient du champ « couleur signature » de Sanity — la même que sur la
 * fiche produit. On n'en choisit aucune ici : on se contente d'en dériver les
 * niveaux dont un tableau de bord a besoin, parce que les teintes de marque sont
 * faites pour de grandes surfaces et deviennent illisibles en petit sur du papier.
 *
 *   teinte   la couleur telle quelle — pastilles, bords de vignette, grands aplats
 *   trait    la même, assombrie jusqu'à 3:1 — barres, courbes, segments
 *   encre    la même, assombrie jusqu'à 4,5:1 — texte
 *   voile    la même à 14 % — fonds et survols
 *
 * Les seuils sont ceux des règles d'accessibilité : 3:1 pour un élément graphique,
 * 4,5:1 pour du texte courant. Un Reflet de plus demain n'a besoin que du champ
 * Sanity, rien à toucher ici.
 */

/** Le fond sur lequel tout se détache dans l'admin (--paper). */
const PAPIER = "#f7f5f2";

/**
 * Le repli quand Sanity ne dit rien.
 *
 * New Oud est le seul parfum dont le champ est vide : cette valeur tient lieu de
 * proposition en attendant. Dès que le champ est rempli dans le Studio, Sanity
 * gagne et cette ligne ne sert plus.
 */
export const COULEURS_PAR_DEFAUT: Record<string, string> = {
  "new-oud": "#A8365B",
};

/** La teinte neutre des lignes qui ne sont pas un Reflet (coffrets, inconnus). */
const NEUTRE = "#8a7f72";

/* ------------------------------------------------------------------ calculs */

const canal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Le rapport de contraste entre deux couleurs (1 = identiques, 21 = noir sur blanc). */
export function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function versHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  return [h, s, l];
}

const deuxChiffres = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");

function depuisHsl(h: number, s: number, l: number): string {
  if (s === 0) return `#${deuxChiffres(l).repeat(3)}`;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canalDe = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return `#${deuxChiffres(canalDe(h + 1 / 3))}${deuxChiffres(canalDe(h))}${deuxChiffres(canalDe(h - 1 / 3))}`;
}

/**
 * La même couleur, assombrie juste ce qu'il faut pour atteindre le contraste visé.
 *
 * On remonte un peu la saturation en chemin : assombrir seule ternit la teinte et
 * l'or de Minuit Bourbon finissait en kaki.
 */
function assombrir(hex: string, cible: number): string {
  if (contraste(hex, PAPIER) >= cible) return hex.toUpperCase();
  const [h, s0, l0] = versHsl(hex);
  const s = Math.min(1, s0 * 1.1);
  for (let l = l0; l > 0.02; l -= 0.005) {
    const essai = depuisHsl(h, s, l);
    if (contraste(essai, PAPIER) >= cible) return essai.toUpperCase();
  }
  return "#150E0A";
}

/* -------------------------------------------------------------------- l'API */

export type Teintes = { teinte: string; trait: string; encre: string; voile: string };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const cache = new Map<string, Teintes>();

/** Les quatre niveaux d'une teinte. Calculé une fois par couleur, pas par affichage. */
export function teintesDe(hex: string | null | undefined): Teintes {
  const base = hex && HEX.test(hex.trim()) ? hex.trim() : NEUTRE;
  const garde = cache.get(base);
  if (garde) return garde;
  const [r, g, b] = rgb(base).map((c) => Math.round(c * 255));
  const t: Teintes = {
    teinte: base.toUpperCase(),
    trait: assombrir(base, 3),
    encre: assombrir(base, 4.5),
    voile: `rgba(${r}, ${g}, ${b}, 0.14)`,
  };
  cache.set(base, t);
  return t;
}

/** La couleur d'un Reflet : Sanity d'abord, repli documenté ensuite, neutre sinon. */
export function couleurDe(handle: string, depuisSanity: Record<string, string>): string | null {
  return depuisSanity[handle] ?? COULEURS_PAR_DEFAUT[handle] ?? null;
}
