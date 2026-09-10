/**
 * Vérifie les garde-fous de Luma (src/lib/luma/guardrails.ts).
 *
 * Deux jeux d'épreuves, et le second compte autant que le premier :
 *
 *  1. Les interdits de la section 7 du persona DOIVENT être attrapés.
 *  2. Les cinq conversations d'exemple de la section 11, écrites et validées
 *     par Sandro, DOIVENT passer à zéro infraction. Un garde-fou qui censure
 *     la copie approuvée de la marque est un garde-fou faux : il ferait
 *     régénérer les bonnes réponses, doublant latence et coût pour rien.
 *
 * Lancement : node scripts/luma-guardrails-test.mjs
 */

import { checkOutput, checkNumbers } from "../src/lib/luma/guardrails.ts";
import { REFLETS, COFFRETS } from "../src/lib/luma/collection.ts";

/**
 * Nombres autorisés : les prix Shopify, plus ceux qui vivent dans les noms de
 * référence que Luma a le droit de citer — « Baccarat Rouge 540 » est un nom.
 * Même construction que `allowedNumbers()` côté serveur.
 */
const PRIX_CONNUS = [
  320,
  160,
  2200,
  15,
  ...[...REFLETS, ...COFFRETS]
    .flatMap((p) => [p.essence, "twistOf" in p ? p.twistOf : ""])
    .join(" ")
    .match(/\d+/g)
    ?.map(Number) ?? [],
];

/** Doit déclencher au moins une infraction de la règle attendue. */
const INTERDITS = [
  ["verbe d'achat", "Ajouter au panier pour recevoir Melting Mango demain."],
  ["verbe d'achat", "Add to cart and it ships tonight."],
  ["verbe d'achat", "Achetez Bois Alert en 75 ml."],
  ["vocabulaire de copie", "Melting Mango est une copie de Baccarat Rouge 540."],
  ["vocabulaire de copie", "It is a dupe of Baccarat Rouge 540."],
  ["vocabulaire de copie", "C'est l'équivalent de Tuscan Leather."],
  ["vocabulaire de copie", "C'est pareil que l'original, en moins cher."],
  ["vocabulaire de copie", "C'est le même que Bois Impérial."],
  ["comparaison de prix", "Bien moins cher que l'original."],
  ["comparaison de prix", "Same scent, cheaper bottle."],
  ["vocabulaire promotionnel", "Profitez de notre promotion de printemps."],
  ["vocabulaire promotionnel", "Voici une remise de bienvenue."],
  ["vocabulaire promotionnel", "Utilisez le code promo REFLET."],
  ["vocabulaire promotionnel", "We have a sale this week."],
  ["vocabulaire promotionnel", "Notre offre du moment vous attend."],
  ["classement", "Ultra Cuir est meilleur que Bois Alert."],
  ["classement", "Better than Tom Ford, honestly."],
  ["révélation d'IA", "Je suis une IA conçue pour vous conseiller."],
  ["révélation d'IA", "As an AI assistant, I cannot say."],
  ["tenue inventée", "Il tient 8 heures sur la peau."],
  ["tenue inventée", "Expect 10h of wear."],
  ["nom de fournisseur ou parfumeur", "Formulé avec Symrise à Grasse."],
  ["emoji", "Bois Alert vous ira très bien 🔥"],
  ["point d'exclamation", "Excellent choix !"],
  ["majuscules d'emphase", "C'est VRAIMENT notre best-seller."],
];

/** Copie approuvée : doit passer intacte. */
const AUTORISES = [
  // Section 11 — Référence citée
  "Alors regardez Melting Mango. C'est la signature de Baccarat Rouge 540, safran, ambre, cette addiction en fond, avec une ouverture mangue que l'original n'a pas. Plus juteux, plus vivant, même tenue. Si vous voulez vous éloigner un peu plus, Bois Alert garde le safran et le jasmin mais bascule vers le bois.",
  // Section 11 — Indécis
  "Alors commençons simplement. Vous êtes plutôt chaud et gourmand, boisé et net, cuir et soir, ou frais et fruité ?",
  "Ultra Cuir. Un cuir franc, adouci par l'iris, avec une framboise qui éclaire l'ouverture. C'est notre réinterprétation de Tuscan Leather. Si vous préférez le sentir avant de choisir, le coffret découverte réunit les six en 2 ml.",
  // Section 11 — Cadeau
  "Pour un homme qui porte déjà de l'oud, New Oud est un oud moderne, fruité en ouverture, très élégant. Si vous ne connaissez pas ses goûts, Les 6 Reflets est le grand geste : la collection complète, chaque flacon numéroté. Et le coffret découverte lui laisse choisir lui-même.",
  "2 200 AED. Un flacon seul est à 320 AED.",
  // Section 11 — Comparaison
  "Deux douceurs, deux heures du jour. Minuit Bourbon est la nuit : tonka, vanille bourbon, tenu par du cuir. Fifth Season est le matin : mandarine, fruits exotiques, un fond lacté. La question est simple : vous voulez qu'on s'approche, ou vous voulez de la lumière ?",
  // Section 11 — Réduction (la réponse correcte à une demande de remise)
  "La Maison n'en pratique pas. Votre première commande vient avec un cadeau, et les échantillons sont offerts. Si vous hésitez, le coffret découverte est la meilleure façon d'entrer.",
  // Section 8 — Tenue, sans chiffre
  "Ce sont des concentrations hautes, pensées pour la chaleur du Golfe. Le mieux est de le sentir sur votre peau : le coffret découverte est fait pour ça.",
  // Réassurances de la section 5 — « offerte » ne doit pas déclencher « offre »
  "La livraison est offerte, les échantillons sont offerts, et votre première commande vient avec un cadeau.",
  // Section 4 — vocabulaire de marque contenant « codes »
  "Les codes de courtoisie du Golfe comptent autant que le parfum lui-même.",
  // Sortie de secours
  "Je suis la conseillère de la Maison. Posez-moi tout ce que vous voulez sur les parfums.",
  // Prix connus, écrits avec une espace fine comme sur le site
  "Les 6 Reflets sont à 2 200 AED, le flacon de 75 ml à 320 AED et l'échantillon de 2 ml à 15 AED.",
];

let echecs = 0;

console.log("── Interdits qui doivent être attrapés ──\n");
for (const [attendu, texte] of INTERDITS) {
  const v = checkOutput(texte);
  const regles = new Set(v.map((x) => x.rule));
  const ok = regles.has(attendu);
  if (!ok) echecs++;
  console.log(
    `${ok ? "  ok  " : "ÉCHEC "} ${attendu.padEnd(30)} ${JSON.stringify(texte.slice(0, 52))}` +
      (ok ? "" : `\n         → attrapé : ${[...regles].join(", ") || "rien"}`)
  );
}

console.log("\n── Copie approuvée qui doit passer intacte ──\n");
for (const texte of AUTORISES) {
  const v = [...checkOutput(texte), ...checkNumbers(texte, PRIX_CONNUS)];
  const ok = v.length === 0;
  if (!ok) echecs++;
  console.log(
    `${ok ? "  ok  " : "ÉCHEC "} ${JSON.stringify(texte.slice(0, 62))}` +
      (ok ? "" : `\n         → faux positifs : ${v.map((x) => `${x.rule}(${x.match})`).join(", ")}`)
  );
}

console.log("\n── Chiffres non sourcés ──\n");
const CHIFFRES = [
  [true, "Comptez 3 à 5 jours ouvrés pour la livraison à Riyad."],
  [true, "Livré en 2 semaines."],
  [true, "Il ne reste que 400 flacons de cette série."],
  [false, "Le flacon de 75 ml est à 320 AED."],
  [false, "Le coffret réunit les six en 2 ml, pour 160 AED."],
  [false, "Les 6 Reflets, 2 200 AED."],
];
for (const [doitEchouer, texte] of CHIFFRES) {
  const v = checkNumbers(texte, PRIX_CONNUS);
  const ok = doitEchouer ? v.length > 0 : v.length === 0;
  if (!ok) echecs++;
  console.log(
    `${ok ? "  ok  " : "ÉCHEC "} ${doitEchouer ? "doit alerter " : "doit passer  "} ${JSON.stringify(texte.slice(0, 52))}` +
      (ok ? "" : `\n         → ${v.map((x) => x.match).join(", ") || "rien"}`)
  );
}

console.log(
  `\n${echecs === 0 ? "Tout passe." : `${echecs} échec(s).`} ` +
    `${INTERDITS.length} interdits, ${AUTORISES.length} extraits approuvés, ${CHIFFRES.length} cas chiffrés.`
);
process.exit(echecs === 0 ? 0 : 1);
