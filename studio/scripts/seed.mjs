import { getCliClient } from "sanity/cli";

// Contenu éditorial fictif — à exécuter avec :
//   npx sanity exec scripts/seed.mjs --with-user-token
// _id déterministes => ré-exécutable sans créer de doublons (createOrReplace).

const client = getCliClient({ apiVersion: "2025-01-01" });

const block = (text, style = "normal", key) => ({
  _type: "block",
  _key: key,
  style,
  markDefs: [],
  children: [{ _type: "span", _key: key + "s", text, marks: [] }],
});

const parfums = [
  {
    _id: "parfum-reflet-n-1-la-braise",
    _type: "parfum",
    shopifyHandle: "reflet-n-1-la-braise",
    nomAffiche: "Reflet N°1 — La Braise",
    histoire:
      "Il est des feux qui ne demandent pas à être vus. La Braise naît de cet instant suspendu où la flamme s'est tue, mais où la chaleur, elle, demeure — tapie sous la cendre, patiente, incandescente. C'est un parfum de l'après : celui du salon qui se vide, du oud que l'on fait brûler pour soi seul, de la présence qui persiste quand les mots se sont tus. Un safran solaire s'y déploie d'abord, puis le jasmin s'installe, soyeux, à peine sucré. Dessous, longtemps après, un bois ambré rayonne — ce sillage qui traverse une pièce sans qu'on sache d'où il vient. On ne remarque pas La Braise tout de suite. On ne l'oublie jamais.",
    notesOlfactives: {
      tete: ["Safran", "Poivre rose", "Bergamote de Calabre"],
      coeur: ["Jasmin Sambac", "Rose de Taïf", "Cannelle de Ceylan"],
      fond: ["Oud", "Ambre", "Bois de santal"],
    },
    inspirationCulturelle:
      "La Braise est un dialogue entre deux gestes : le bakhoor que l'on fait passer sous les vêtements dans les maisons du Golfe, rituel de l'hospitalité arabe — et la rigueur de la parfumerie française, qui sait tenir une note sans jamais la forcer. Le safran et l'oud y parlent l'arabe ; le jasmin de Grasse y répond en français. Ni tout à fait l'Orient, ni tout à fait l'Occident : la chaleur d'un même feu, que les deux rives reconnaissent.",
  },
  {
    _id: "parfum-reflet-n-2-leclipse",
    _type: "parfum",
    shopifyHandle: "reflet-n-2-leclipse",
    nomAffiche: "Reflet N°2 — L'éclipse",
    histoire:
      "L'éclipse est l'instant où la lumière consent à l'ombre. Quelques secondes où le jour se voile, où le monde retient son souffle et se découvre autrement. Ce parfum habite ce seuil : il s'ouvre froid, minéral, presque secret, sur une bergamote enveloppée d'encens. Puis l'iris se lève, poudré, aristocratique, et le cœur se réchauffe imperceptiblement. Vient enfin le cuir, fumé, profond, adouci d'un musc blanc — la nuit qui gagne, sans jamais éteindre. L'éclipse ne se donne pas au premier regard. Elle se mérite, comme les choses qui ne se répètent pas.",
    notesOlfactives: {
      tete: ["Bergamote", "Encens", "Cardamome noire"],
      coeur: ["Iris", "Violette", "Safran"],
      fond: ["Cuir", "Oud", "Musc blanc"],
    },
    inspirationCulturelle:
      "Il y a dans L'éclipse quelque chose du crépuscule du désert, cette heure bleue où le sable change de camp et où l'encens monte des maisons. Et quelque chose des soirs de Paris, du cuir d'un fauteuil de club, de l'iris des parfumeurs du Faubourg. La Maison a cherché le point exact où l'obscurité orientale et l'élégance occidentale coïncident — non pas se mélangent, mais s'éclipsent l'une l'autre, tour à tour.",
  },
];

const pageMaison = {
  _id: "page-maison",
  _type: "page",
  title: "La Maison",
  slug: { _type: "slug", current: "maison" },
  content: [
    block(
      "Maison Reflet est née d'une conviction simple : le parfum est un miroir. Il ne se contente pas d'habiller — il révèle. Il dit d'où l'on vient, les mondes que l'on porte, les frontières que l'on a cessé de voir comme des frontières.",
      "normal",
      "b1"
    ),
    block("Entre deux rives", "h2", "b2"),
    block(
      "Entre les jardins de Grasse et les souks d'Arabie, entre la rigueur de la haute parfumerie française et l'intensité des matières orientales — oud, ambre, safran, rose de Taïf — chaque création de la Maison raconte une double appartenance. Nous ne choisissons pas un camp. Nous réconcilions.",
      "normal",
      "b3"
    ),
    block("Les 6 Reflets", "h2", "b4"),
    block(
      "La collection Les 6 Reflets compose un pont olfactif entre la France et le monde arabe. Six fragrances, six états d'une même identité : ni tout à fait l'une, ni tout à fait l'autre, profondément les deux. Chaque flacon porte son numéro, gravé comme une signature.",
      "normal",
      "b5"
    ),
    block("L'art de la rareté", "h2", "b6"),
    block(
      "Une maison de parfum ne se mesure pas au nombre de flacons vendus, mais à la justesse de ce qu'elle laisse derrière elle : un sillage, une émotion, un souvenir. C'est pourquoi nos créations sont pensées comme des pièces rares — formulées avec exigence, éditées avec retenue, offertes comme on confie un secret.",
      "normal",
      "b7"
    ),
  ],
};

const docs = [...parfums, pageMaison];

for (const doc of docs) {
  await client.createOrReplace(doc);
  console.log("✓", doc._id);
}
console.log(`\n${docs.length} documents créés/mis à jour dans le dataset.`);
