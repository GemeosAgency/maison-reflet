import { getCliClient } from "sanity/cli";

// Contenu de démarrage, aligné sur la nouvelle structure (i18n + notes en
// bibliothèque). À exécuter : npx sanity exec scripts/seed.mjs --with-user-token
// _id déterministes => ré-exécutable sans doublon (createOrReplace).
// FR rempli ; AR/EN prêts à être traduits dans le Studio.

const client = getCliClient({ apiVersion: "2025-01-01" });

// ---------- Bibliothèque de notes (matières) ----------
const NOTES = [
  ["safran", "Safran", "Épicée"],
  ["poivre-rose", "Poivre rose", "Épicée"],
  ["bergamote", "Bergamote de Calabre", "Hespéridée"],
  ["jasmin", "Jasmin Sambac", "Florale"],
  ["rose-taif", "Rose de Taïf", "Florale"],
  ["cannelle", "Cannelle de Ceylan", "Épicée"],
  ["oud", "Oud", "Boisée"],
  ["ambre", "Ambre", "Ambrée"],
  ["santal", "Bois de santal", "Boisée"],
  ["encens", "Encens", "Orientale"],
  ["cardamome", "Cardamome noire", "Épicée"],
  ["iris", "Iris", "Florale"],
  ["violette", "Violette", "Florale"],
  ["cuir", "Cuir", "Autre"],
  ["musc", "Musc blanc", "Musquée"],
];

const noteDocs = NOTES.map(([id, nom, famille]) => ({
  _id: `note-${id}`,
  _type: "note",
  nom: { fr: nom },
  famille,
}));

const refs = (...ids) =>
  ids.map((id, i) => ({ _type: "reference", _ref: `note-${id}`, _key: `${id}${i}` }));

const block = (text, style = "normal", key) => ({
  _type: "block",
  _key: key,
  style,
  markDefs: [],
  children: [{ _type: "span", _key: key + "s", text, marks: [] }],
});

// ---------- Réglages (singleton) ----------
const settings = {
  _id: "settings",
  _type: "settings",
  brandName: "Maison Reflet",
  baseline: { fr: "Six parfums, six reflets d'une identité franco-arabe." },
  about: {
    fr: "Maison de parfum née d'une conviction : le parfum est un miroir. Un pont olfactif entre la France et le monde arabe.",
  },
  contactEmail: "contact@maisonreflet.com",
};

// ---------- Parfums ----------
const parfums = [
  {
    _id: "parfum-reflet-n-1-la-braise",
    _type: "parfum",
    shopifyHandle: "reflet-n-1-la-braise",
    nomAffiche: "Reflet N°1 — La Braise",
    accroche: { fr: "La chaleur d'un feu que les deux rives reconnaissent." },
    familleOlfactive: "Ambrée",
    couleurSignature: "#7A2E1E",
    histoire: {
      fr: "Il est des feux qui ne demandent pas à être vus. La Braise naît de cet instant suspendu où la flamme s'est tue, mais où la chaleur, elle, demeure — tapie sous la cendre, patiente, incandescente. Un safran solaire s'y déploie d'abord, puis le jasmin s'installe, soyeux. Dessous, longtemps après, un bois ambré rayonne. On ne remarque pas La Braise tout de suite. On ne l'oublie jamais.",
    },
    inspirationCulturelle: {
      fr: "La Braise est un dialogue entre le bakhoor des maisons du Golfe et la rigueur de la parfumerie française. Le safran et l'oud y parlent l'arabe ; le jasmin de Grasse y répond en français.",
    },
    notesTete: refs("safran", "poivre-rose", "bergamote"),
    notesCoeur: refs("jasmin", "rose-taif", "cannelle"),
    notesFond: refs("oud", "ambre", "santal"),
  },
  {
    _id: "parfum-reflet-n-2-leclipse",
    _type: "parfum",
    shopifyHandle: "reflet-n-2-leclipse",
    nomAffiche: "Reflet N°2 — L'éclipse",
    accroche: { fr: "L'instant où la lumière consent à l'ombre." },
    familleOlfactive: "Boisée",
    couleurSignature: "#1B2A4A",
    histoire: {
      fr: "L'éclipse est l'instant où la lumière consent à l'ombre. Ce parfum habite ce seuil : il s'ouvre froid, minéral, presque secret, sur une bergamote enveloppée d'encens. Puis l'iris se lève, poudré, aristocratique. Vient enfin le cuir, fumé, profond, adouci d'un musc blanc. L'éclipse ne se donne pas au premier regard. Elle se mérite.",
    },
    inspirationCulturelle: {
      fr: "Il y a dans L'éclipse quelque chose du crépuscule du désert et des soirs de Paris. La Maison a cherché le point exact où l'obscurité orientale et l'élégance occidentale coïncident.",
    },
    notesTete: refs("bergamote", "encens", "cardamome"),
    notesCoeur: refs("iris", "violette", "safran"),
    notesFond: refs("cuir", "oud", "musc"),
  },
];

// ---------- Page « La Maison » ----------
const pageMaison = {
  _id: "page-maison",
  _type: "page",
  title: { fr: "La Maison" },
  slug: { _type: "slug", current: "maison" },
  content: {
    fr: [
      block(
        "Maison Reflet est née d'une conviction simple : le parfum est un miroir. Il ne se contente pas d'habiller — il révèle. Il dit d'où l'on vient, les mondes que l'on porte, les frontières que l'on a cessé de voir comme des frontières.",
        "normal",
        "b1"
      ),
      block("Entre deux rives", "h2", "b2"),
      block(
        "Entre les jardins de Grasse et les souks d'Arabie, entre la rigueur de la haute parfumerie française et l'intensité des matières orientales, chaque création raconte une double appartenance. Nous ne choisissons pas un camp. Nous réconcilions.",
        "normal",
        "b3"
      ),
      block("Les 6 Reflets", "h2", "b4"),
      block(
        "La collection Les 6 Reflets compose un pont olfactif entre la France et le monde arabe. Six fragrances, six états d'une même identité. Chaque flacon porte son numéro, gravé comme une signature.",
        "normal",
        "b5"
      ),
    ],
  },
};

const docs = [settings, ...noteDocs, ...parfums, pageMaison];

for (const doc of docs) {
  await client.createOrReplace(doc);
  console.log("✓", doc._id);
}
console.log(`\n${docs.length} documents créés/mis à jour.`);
