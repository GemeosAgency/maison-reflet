/**
 * Les portraits audio des six Reflets (idée de Sandro, 11 septembre 2026) :
 * une définition claire de chaque parfum, dans la voix de Luma, écrite une
 * fois, générée une fois (scripts/luma-voice-portraits.mjs), servie en fichier
 * statique — zéro crédit à l'écoute. Fiche produit et cartes de Luma y renvoient.
 *
 * Structure : le nom ; une image (moment, geste) ; la pyramide en matières,
 * telles que Sanity les donne ; la filiation (« notre réinterprétation de… »,
 * ce qu'on garde, ce qu'on ajoute) ; une chute. Pas de question : c'est un
 * portrait, pas un tour de conversation. Les indications entre crochets sont
 * pour la voix (v3) et retirées du texte affiché. Mêmes interdits que Luma.
 *
 * Arabe : à écrire quand la voix arabe sera validée.
 */

import type { Locale } from "../../i18n";

export const PORTRAITS: Partial<Record<Locale, Record<string, string>>> = {
  fr: {
    "bois-alert":
      "[warmly] Bois Alert. Le boisé qu'on porte sans y penser, du matin au dîner — celui qu'on recommande quand on ne sait pas. [inhales] En tête, poivre noir, safran, bergamote de Calabre. Au cœur, jasmin sambac, ambre gris, un caramel discret. En fond, vétiver, patchouli, cèdre. [exhales] Notre réinterprétation de Bois Impérial, enrichie des facettes safran et jasmin de Baccarat Rouge 540. Un feu net, aérien, que les deux rives reconnaissent.",
    "new-oud":
      "[warmly] New Oud. L'oud d'aujourd'hui : fruité à l'ouverture, floral au cœur, jamais médicinal. [inhales] En tête, fruit de la passion, safran, mandarine. Au cœur, rose de Taïf, muguet, ambre. En fond, bois de santal, oud, musc blanc. [exhales] Notre réinterprétation d'Oud Maracuja, avec un santal poudré et un floral blanc lumineux. Pour qui aime l'oud, et veut qu'il respire.",
    "melting-mango":
      "[upbeat] Melting Mango. Une mangue qui fond dès l'ouverture, juteuse, solaire — puis la chaleur ambrée qu'on reconnaît entre mille. [inhales] En tête, mangue, safran, orange. Au cœur, praline, noyau d'abricot, jasmin absolu. En fond, mousse de chêne, patchouli, vétiver d'Haïti. [exhales] Notre réinterprétation de Baccarat Rouge 540, avec cette surdose de mangue que l'original n'a pas. Plus vivant, même addiction.",
    "ultra-cuir":
      "[warmly] Ultra Cuir. Une veste de cuir qu'on garde sur les épaules quand le soir tombe. [inhales] En tête, framboise, bergamote de Calabre, baie rouge — une ouverture qui éclaire. Au cœur, encens, un trio de safrans, iris. En fond, cèdre, cuir, patchouli. [exhales] Notre réinterprétation de Tuscan Leather, plus lumineuse au départ, plus texturée au cœur. Le cuir assumé, adouci par l'iris.",
    "minuit-bourbon":
      "[warmly] Minuit Bourbon. La gourmandise de la nuit : tonka et vanille, tenues par un cuir qui les empêche de fondre. [inhales] En tête, cardamome, bergamote de Calabre, cannelle de Ceylan. Au cœur, fleur d'oranger, amande, lavande. En fond, fève tonka, vanille Bourbon, cuir. [exhales] Notre réinterprétation d'Althaïr, avec cet accord cuir qui donne de la structure à la chaleur. Chaud, enveloppant, après minuit.",
    "fifth-season":
      "[upbeat] Fifth Season. Le matin, la lumière : un fruité solaire rendu plus fondu, plus facile à porter. [inhales] En tête, mandarine, orange, fruits exotiques. Au cœur, jasmin sambac, caramel, muguet. En fond, vanille Bourbon, musc blanc, fève tonka. [exhales] Notre réinterprétation d'Erba Pura, adoucie d'une touche lactée. Le plus frais de la collection — celui du jour.",
  },
  en: {
    "bois-alert":
      "[warmly] Bois Alert. The woody scent you wear without thinking, from morning to dinner — the one we recommend when you don't know where to start. [inhales] On top, black pepper, saffron, Calabrian bergamot. At the heart, sambac jasmine, ambergris, a discreet caramel. In the base, vetiver, patchouli, cedar. [exhales] Our reinterpretation of Bois Impérial, enriched with the saffron and jasmine facets of Baccarat Rouge 540. A clean, airy fire that both shores recognise.",
    "new-oud":
      "[warmly] New Oud. Today's oud: fruity on opening, floral at the heart, never medicinal. [inhales] On top, passion fruit, saffron, mandarin. At the heart, Taif rose, lily of the valley, amber. In the base, sandalwood, oud, white musk. [exhales] Our reinterpretation of Oud Maracuja, with a powdery sandalwood and a luminous white floral. For those who love oud, and want it to breathe.",
    "melting-mango":
      "[upbeat] Melting Mango. A mango that melts from the very first second, juicy, sun-drenched — then the amber warmth you would recognise anywhere. [inhales] On top, mango, saffron, orange. At the heart, praline, apricot kernel, jasmine absolute. In the base, oakmoss, patchouli, Haitian vetiver. [exhales] Our reinterpretation of Baccarat Rouge 540, with an overdose of mango the original never had. More alive, same addiction.",
    "ultra-cuir":
      "[warmly] Ultra Cuir. A leather jacket kept on your shoulders as the evening falls. [inhales] On top, raspberry, Calabrian bergamot, red berry — an opening that lights everything up. At the heart, incense, a trio of saffrons, iris. In the base, cedar, leather, patchouli. [exhales] Our reinterpretation of Tuscan Leather, brighter at the start, more textured at the heart. Leather, fully assumed, softened by iris.",
    "minuit-bourbon":
      "[warmly] Minuit Bourbon. The gourmand of the night: tonka and vanilla, held by a leather that keeps them from melting away. [inhales] On top, cardamom, Calabrian bergamot, Ceylon cinnamon. At the heart, orange blossom, almond, lavender. In the base, tonka bean, Bourbon vanilla, leather. [exhales] Our reinterpretation of Althaïr, with a leather accord that gives the warmth its structure. Warm, enveloping, after midnight.",
    "fifth-season":
      "[upbeat] Fifth Season. Morning, light: a sun-drenched fruity scent made softer, easier to wear. [inhales] On top, mandarin, orange, exotic fruits. At the heart, sambac jasmine, caramel, lily of the valley. In the base, Bourbon vanilla, white musk, tonka bean. [exhales] Our reinterpretation of Erba Pura, softened with a milky touch. The freshest of the collection — the one for daytime.",
  },
};

/** Le fichier statique du portrait, s'il existe pour cette langue. */
export function portraitAudioPath(locale: Locale, handle: string): string | null {
  return PORTRAITS[locale]?.[handle] ? `/luma/voice/${locale}/parfums/${handle}.mp3` : null;
}

/** Le texte du portrait sans ses indications de voix — pour l'afficher ou le lire à l'écran. */
export function portraitText(locale: Locale, handle: string): string | null {
  const script = PORTRAITS[locale]?.[handle];
  return script ? script.replace(/\[[^\]]{1,40}\]/g, " ").replace(/\s{2,}/g, " ").trim() : null;
}
