import { getCliClient } from "sanity/cli";

// npx sanity exec scripts/add-la-lune.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

// Deux nouvelles matières pour la bibliothèque de notes (réutilisables plus tard).
await client.createIfNotExists({
  _id: "note-aldehydes",
  _type: "note",
  nom: { fr: "Aldéhydes", en: "Aldehydes", ar: "الدهيدات" },
  famille: "Autre",
  histoire: {
    fr: "Note synthétique sans équivalent naturel, découverte au tournant du XXe siècle. Elle donne cet éclat métallique et pétillant, presque lumineux — la sensation d'un rayon qui traverse l'air froid de la nuit.",
  },
});

await client.createIfNotExists({
  _id: "note-fleur-de-lys",
  _type: "note",
  nom: { fr: "Fleur de lys", en: "Lily flower", ar: "زهرة الزنبق" },
  famille: "Florale",
  histoire: {
    fr: "Fleur blanche à floraison nocturne, à l'odeur poudrée et silencieuse. Elle ne s'épanouit jamais en plein jour.",
  },
});

const refs = (...ids) =>
  ids.map((id, i) => ({ _type: "reference", _ref: `note-${id}`, _key: `${id}${i}` }));

await client.createOrReplace({
  _id: "parfum-la-lune",
  _type: "parfum",
  shopifyHandle: "la-lune",
  nomAffiche: "Reflet N°6 — La Lune",
  inspiredBy: "Blanche (Byredo)",
  accroche: { fr: "Un reflet de lumière, jamais la source." },
  familleOlfactive: "Florale",
  couleurSignature: "#B7BFD6",
  notesTete: refs("bergamote", "aldehydes"),
  notesCoeur: refs("iris", "fleur-de-lys"),
  notesFond: refs("santal", "ambre", "musc"),
  blocs: [
    {
      _type: "blocEditorial",
      _key: "histoire",
      titre: { fr: "L'histoire", en: "The story", ar: "الحكاية" },
      texte: {
        fr: "La Lune ne produit aucune lumière — elle emprunte celle du soleil et nous la renvoie, adoucie, presque respirable. Une bergamote givrée s'ouvre sur un sillage d'aldéhydes, comme un rayon qui traverse la nuit. Puis l'iris et la fleur de lys s'installent, poudrés, silencieux. En fond, le même trio qui traverse toute la collection — santal, ambre, musc — mais ici retenu, comme vu à travers un voile. Un parfum qui ne s'impose jamais : il reflète.",
      },
      imageAGauche: false,
    },
    {
      _type: "blocEditorial",
      _key: "inspiration",
      titre: { fr: "Inspiration", en: "Inspiration", ar: "الإلهام" },
      texte: {
        fr: "La lune se lève de la même façon sur Paris et sur le désert d'Arabie — un seul astre, deux horizons qui le regardent. La Lune capture cette lumière commune, empruntée à tous, n'appartenant à personne.",
      },
      imageAGauche: true,
    },
  ],
});
console.log("✓ La Lune créée dans Sanity");
