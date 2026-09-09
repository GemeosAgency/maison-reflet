/**
 * Bibliothèque de matières + pyramide olfactive d'un parfum.
 *
 * Deux étapes :
 *  1. crée les matières manquantes dans la bibliothèque (type `note`), en
 *     téléversant leur photo quand on en a une ;
 *  2. assigne notesTete / notesCoeur / notesFond du parfum, dans l'ordre.
 *
 * Les matières sont PARTAGÉES entre parfums : une matière est photographiée
 * une fois puis réutilisée. Le script ne recrée jamais une matière dont le
 * nom français existe déjà — il la réutilise, et lui ajoute sa photo si elle
 * n'en avait pas.
 *
 * Rappel sur l'affichage (voir components/product/ScentNotes.astro) : la note
 * mise en gras est la première de la colonne QUI A UNE PHOTO, et c'est cette
 * photo qui remplit la colonne. L'ordre ci-dessous est donc significatif.
 *
 *   SANITY_WRITE_TOKEN=sk... node scripts/sanity-notes-parfum.mjs --dry
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

// ---------------------------------------------------------------------------
// MATIÈRES à garantir dans la bibliothèque.
//
// `photo` : fichier local déjà recadré au ratio de la bibliothèque (958x1120,
// soit 0,8554 — celui de la colonne Scent Notes). Omettre si on n'en a pas.
//
// Deux règles apprises en recadrant les 14 premières :
//
//  - prendre la source via `download_assets` sur le node du triptyque, PAS via
//    `get_design_context` : celui-ci ne rend que des remplissages plafonnés à
//    ~700-870px, l'autre rend la source telle que stockée dans Figma
//    (1024-1332px), donc au-dessus du standard après recadrage.
//
//  - recadrer en CENTRANT LE SUJET, pas le cadre. Les sources sont plus hautes
//    que 0,8554 et la matière n'y est pas au milieu : un recadrage centré sur
//    le cadre la laissait 10 à 13 points trop bas dans la colonne.
// ---------------------------------------------------------------------------
const MATIERES = [
  // Bois Brouge (11088:5462)
  { fr: "Poivre noir", en: "Black Pepper", famille: "Épicée", photo: "poivre-noir.jpg" },
  { fr: "Patchouli", en: "Patchouli", famille: "Boisée", photo: "patchouli.jpg" },
  { fr: "Vétiver", en: "Vetiver", famille: "Boisée" },
  { fr: "Cèdre", en: "Cedarwood", famille: "Boisée" },
  { fr: "Ambre gris", en: "Ambergris", famille: "Ambrée" },
  // Melting Mango (11088:3146)
  { fr: "Mangue", en: "Mango", famille: "Autre", photo: "mangue.jpg" },
  { fr: "Jasmin absolu", en: "Jasmine Abs", famille: "Florale", photo: "jasmin-absolu.jpg" },
  { fr: "Mousse de chêne", en: "Oak Moss", famille: "Boisée", photo: "mousse-de-chene.jpg" },
  { fr: "Praline", en: "Praline", famille: "Autre" },
  { fr: "Noyau d'abricot", en: "Apricot Seed", famille: "Autre" },
  { fr: "Vétiver Haïti", en: "Vetiver Haiti", famille: "Boisée" },
  // Ultra Cuir (11088:3736) — la photo de safran et celle de cuir viennent
  // compléter deux matières déjà présentes mais sans visuel.
  { fr: "Framboise", en: "Raspberry", famille: "Autre", photo: "framboise.jpg" },
  { fr: "Baie rouge", en: "Red Berry", famille: "Autre" },
  { fr: "Safran", en: "Saffron", famille: "Épicée", photo: "safran.jpg" },
  { fr: "Cuir", en: "Leather", famille: "Autre", photo: "cuir.jpg" },
  // Minuit Bourbon (11088:4318)
  { fr: "Cardamome", en: "Cardamom", famille: "Épicée", photo: "cardamome.jpg" },
  { fr: "Fleur d'oranger", en: "Orange Blossom", famille: "Florale", photo: "fleur-d-oranger.jpg" },
  { fr: "Amande", en: "Almond", famille: "Autre" },
  { fr: "Lavande", en: "Lavender", famille: "Aromatique" },
  { fr: "Fève tonka", en: "Tonka Bean", famille: "Ambrée", photo: "feve-tonka.jpg" },
  // New Oud (11088:4890)
  { fr: "Fruit de la passion", en: "Passion Fruit", famille: "Autre", photo: "fruit-de-la-passion.jpg" },
  { fr: "Rose de Taïf", en: "Rose", famille: "Florale", photo: "rose.jpg" },
  { fr: "Oud", en: "Agarwood", famille: "Boisée", photo: "oud.jpg" },
  // Fifth Season (11003:7059) : aucune matière à créer, tout existe déjà.
];

// ---------------------------------------------------------------------------
// PYRAMIDES par parfum, relevées dans Figma (node 11088:5462 pour Bois
// Brouge : TOP Black Pepper / Saffron / Bergamot, HEART Jasmine / Ambre Gris /
// Caramel, BASE Vetiver / Patchouli / Cedarwood).
//
// Les noms doivent correspondre au `nom.fr` de la bibliothèque.
// ---------------------------------------------------------------------------
const PYRAMIDES = [
  {
    // 11088:5462 — TOP Black Pepper / Saffron / Bergamot,
    // HEART Jasmine / Ambre Gris / Caramel, BASE Vetiver / Patchouli / Cedarwood
    handle: "bois-brouge",
    tete: ["Poivre noir", "Safran", "Bergamote de Calabre"],
    coeur: ["Jasmin Sambac", "Ambre gris", "Caramel"],
    fond: ["Vétiver", "Patchouli", "Cèdre"],
  },
  {
    // 11088:3146
    handle: "melting-mango",
    tete: ["Mangue", "Safran", "Orange"],
    coeur: ["Praline", "Noyau d'abricot", "Jasmin absolu"],
    fond: ["Mousse de chêne", "Patchouli", "Vétiver Haïti"],
  },
  {
    // 11088:3736 — "Olibanum" = encens, "Orris" = iris : on réutilise les
    // matières déjà en bibliothèque plutôt que d'ajouter des doublons.
    handle: "ultra-cuir",
    tete: ["Framboise", "Bergamote de Calabre", "Baie rouge"],
    coeur: ["Encens", "Safran", "Iris"],
    fond: ["Cèdre", "Cuir", "Patchouli"],
  },
  {
    // 11088:4318
    handle: "minuit-bourbon",
    tete: ["Cardamome", "Bergamote de Calabre", "Cannelle de Ceylan"],
    coeur: ["Fleur d'oranger", "Amande", "Lavande"],
    fond: ["Fève tonka", "Vanille Bourbon", "Cuir"],
  },
  {
    // 11088:4890 — "Agarwood" = oud. La maquette dit "Rose" ; on garde
    // "Rose de Taïf", le terme de la bibliothèque, plutôt qu'un doublon.
    handle: "new-oud",
    tete: ["Fruit de la passion", "Safran", "Mandarin"],
    coeur: ["Rose de Taïf", "Muguet", "Ambre"],
    fond: ["Bois de santal", "Oud", "Musc blanc"],
  },
  {
    // 11003:7059 — ce sont les notes qui étaient à tort sur Bois Brouge.
    handle: "fifth-season",
    tete: ["Mandarin", "Orange", "Fruits exotiques"],
    coeur: ["Jasmin Sambac", "Caramel", "Muguet"],
    fond: ["Vanille Bourbon", "Musc blanc", "Fève tonka"],
  },
];

const DOSSIER_IMAGES = process.env.DOSSIER_IMAGES ?? ".";
const dry = process.argv.includes("--dry");

const env = { ...process.env };
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
if (!env.SANITY_WRITE_TOKEN) {
  console.error("SANITY_WRITE_TOKEN manquant (rôle Editor requis).");
  process.exit(1);
}

const client = createClient({
  projectId: env.SANITY_PROJECT_ID,
  dataset: env.SANITY_DATASET,
  apiVersion: env.SANITY_API_VERSION,
  token: env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

// --- 1. bibliothèque -------------------------------------------------------

const existantes = await client.fetch(
  `*[_type == "note" && !(_id in path("drafts.**"))]{ _id, "fr": nom.fr, "aPhoto": defined(image) }`
);
const parNom = new Map(existantes.map((n) => [n.fr, n]));
console.log(`bibliothèque : ${existantes.length} matières, ${existantes.filter((n) => n.aPhoto).length} avec photo\n`);

const idParNom = new Map(existantes.map((n) => [n.fr, n._id]));

for (const m of MATIERES) {
  const deja = parNom.get(m.fr);
  const chemin = m.photo ? path.join(DOSSIER_IMAGES, m.photo) : null;
  const photoDispo = chemin && fs.existsSync(chemin);
  if (m.photo && !photoDispo) console.error(`  ! photo introuvable : ${chemin}`);

  if (deja && (deja.aPhoto || !photoDispo)) {
    console.log(`  = ${m.fr} : déjà en bibliothèque${deja.aPhoto ? " (avec photo)" : ""}`);
    continue;
  }

  if (dry) {
    console.log(`  ${deja ? "+photo" : "créer "} ${m.fr}${photoDispo ? ` (${m.photo})` : " (sans photo)"}`);
    if (!deja) idParNom.set(m.fr, "<nouveau>");
    continue;
  }

  let image;
  if (photoDispo) {
    const asset = await client.assets.upload("image", fs.createReadStream(chemin), { filename: m.photo });
    image = { _type: "image", asset: { _type: "reference", _ref: asset._id } };
  }

  if (deja) {
    await client.patch(deja._id).set({ image }).commit();
    console.log(`  +photo ${m.fr}`);
  } else {
    const doc = await client.create({
      _type: "note",
      nom: { _type: "localeString", fr: m.fr, ...(m.en ? { en: m.en } : {}) },
      ...(m.famille ? { famille: m.famille } : {}),
      ...(image ? { image } : {}),
    });
    idParNom.set(m.fr, doc._id);
    console.log(`  créée ${m.fr} -> ${doc._id}`);
  }
}

// --- 2. pyramides ----------------------------------------------------------

const ref = (nom, i, niveau) => {
  const id = idParNom.get(nom);
  if (!id) throw new Error(`matière absente de la bibliothèque : "${nom}"`);
  return { _type: "reference", _ref: id, _key: `${niveau}${i}` };
};

for (const p of PYRAMIDES) {
  console.log(`\n=== ${p.handle} ===`);
  const docs = await client.fetch(`*[_type == "parfum" && shopifyHandle == $h]{ _id }`, { h: p.handle });
  if (docs.length === 0) {
    console.error(`  aucun document parfum avec shopifyHandle "${p.handle}"`);
    continue;
  }

  const set = {
    notesTete: p.tete.map((n, i) => ref(n, i, "t")),
    notesCoeur: p.coeur.map((n, i) => ref(n, i, "c")),
    notesFond: p.fond.map((n, i) => ref(n, i, "f")),
  };
  console.log(`  tête  : ${p.tete.join(" · ")}`);
  console.log(`  cœur  : ${p.coeur.join(" · ")}`);
  console.log(`  fond  : ${p.fond.join(" · ")}`);

  if (dry) {
    console.log(`  [--dry] ${docs.length} document(s) seraient patchés.`);
    continue;
  }
  let tx = client.transaction();
  for (const d of docs) tx = tx.patch(d._id, { set });
  await tx.commit();
  console.log(`  ✓ ${docs.length} document(s) mis à jour.`);
}
