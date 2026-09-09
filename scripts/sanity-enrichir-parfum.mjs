/**
 * Enrichit une fiche parfum dans Sanity d'après la maquette Figma.
 *
 * Sert de gabarit : le bloc FICHES ci-dessous porte les valeurs, le reste est
 * générique. Pour traiter un autre parfum, ajoute une entrée et relance.
 *
 * Ce que fait le script :
 *  - téléverse les visuels locaux dans Sanity (imageTwist, perfumerPhoto) ;
 *  - écrit les champs de spécifications (famille, intensité, sillage, etc.) ;
 *  - VIDE les champs dont le contenu est faux plutôt que de le laisser en
 *    ligne. Une section non remplie se masque d'elle-même sur la fiche (voir
 *    parfums/[handle].astro) : mieux vaut une section absente qu'un lorem
 *    ipsum ou un texte qui parle d'un autre parfum.
 *
 * Les brouillons sont patchés en même temps que les documents publiés, sinon
 * une publication ultérieure réintroduirait l'ancien contenu.
 *
 *   SANITY_WRITE_TOKEN=sk... node scripts/sanity-enrichir-parfum.mjs --dry
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

// ---------------------------------------------------------------------------
// FICHES — valeurs relevées dans Figma (node 11088:5462 pour Bois Brouge)
// ---------------------------------------------------------------------------
const FICHES = [
  {
    handle: "bois-brouge",

    // « Olfactive family » de la maquette : "Woody, Airy".
    familles: { fr: "Boisé, Aérien", en: "Woody, Airy", ar: "خشبي، هوائي" },

    // Jauges comptées sur la maquette : intensité 5 pastilles pleines sur 5,
    // sillage 4 sur 5 (la 5e est grise). Les deux affichent « High ».
    intensite: 5,
    sillage: 4,

    // Badge BEST SELLER présent sur la tuile Bois Brouge de la maquette.
    bestSeller: true,

    // Alimente « Specific Twist of … » sous le nom, dans les tuiles et le
    // panier. Valait "Baccarat Rouge 540", qui est la référence secondaire :
    // la maquette présente Bois Impérial comme l'inspiration principale.
    inspiredBy: "Bois Impérial",

    // Remplace la description qui était en ligne : c'était celle de FIFTH
    // SEASON (Erba Pura, Bleu de Chanel, Bianco Latte), pas celle-ci.
    description: {
      fr:
        "Nous avons réinterprété l'ADN boisé et affirmé de Bois Impérial — " +
        "Essential Parfums, en enrichissant sa signature boisée, riche et " +
        "vibrante, des facettes iconiques de safran, de jasmin et de mousse " +
        "sucrée de Baccarat Rouge 540 — Maison Francis Kurkdjian.",
      en:
        "We reimagined the bold woody DNA of Bois Impérial - Essential " +
        "Parfums, enriching its rich, vibrant woody signature with the " +
        "iconic saffron, jasmine and sweet mossy facets of Baccarat Rouge " +
        "540 - Maison Francis Kurkdjian.",
    },

    // Le texte parlait encore de « Lune », nom de produit supprimé. Seule
    // correction factuelle apportée — le profil décrit (santal, rose de Taïf)
    // ne correspond toujours pas à la description ci-dessus, à réécrire.
    remplacerDansTwist: [["Lune", "Bois Brouge"]],

    // perfumerWord contenait un lorem ipsum, servi tel quel sur la fiche.
    // Vidé : la section se masque jusqu'à ce que le vrai texte soit écrit.
    vider: ["perfumerWord"],

    // Visuels recadrés au ratio de la maquette depuis les sources Figma
    // (1296x560 pour le twist, 816x560 pour le parfumeur), à leur résolution
    // native et non à celle de l'export, qui n'est qu'en 1x.
    images: {
      imageTwist: { fichier: "twist-crop.jpg", ratio: "1296/560" },
      perfumerPhoto: { fichier: "perfumer-crop.jpg", ratio: "816/560" },
    },
  },
];

// Dossier où se trouvent les fichiers listés dans `images`.
const DOSSIER_IMAGES = process.env.DOSSIER_IMAGES ?? ".";

// ---------------------------------------------------------------------------

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

/** localeString : un objet { _type, fr, en, ar } sans les langues absentes. */
const localeString = (v) => ({
  _type: "localeString",
  ...Object.fromEntries(Object.entries(v).filter(([, t]) => t)),
});

/**
 * localeBlock : chaque langue est un tableau de blocs Portable Text. Les _key
 * doivent être uniques dans le tableau, pas entre documents.
 */
const localeBlock = (v) => ({
  _type: "localeBlock",
  ...Object.fromEntries(
    Object.entries(v)
      .filter(([, t]) => t)
      .map(([lang, texte]) => [
        lang,
        [
          {
            _type: "block",
            _key: `${lang}0`,
            style: "normal",
            markDefs: [],
            children: [{ _type: "span", _key: `${lang}0s`, text: texte, marks: [] }],
          },
        ],
      ])
  ),
});

for (const fiche of FICHES) {
  console.log(`\n=== ${fiche.handle} ===`);

  const docs = await client.fetch(
    `*[_type == "parfum" && shopifyHandle == $h]{ _id, specificTwist }`,
    { h: fiche.handle }
  );
  if (docs.length === 0) {
    console.error(`  aucun document parfum avec shopifyHandle "${fiche.handle}"`);
    continue;
  }

  // Téléversement des visuels : une seule fois, puis référencé par tous les
  // documents (publié + brouillons) de la fiche.
  const assets = {};
  for (const [champ, { fichier, ratio }] of Object.entries(fiche.images ?? {})) {
    const chemin = path.join(DOSSIER_IMAGES, fichier);
    if (!fs.existsSync(chemin)) {
      console.error(`  ${champ} : fichier introuvable (${chemin}) — champ ignoré`);
      continue;
    }
    const octets = fs.statSync(chemin).size;
    if (dry) {
      console.log(`  ${champ} : téléverserait ${fichier} (${Math.round(octets / 1024)} Ko, ratio ${ratio})`);
      continue;
    }
    const asset = await client.assets.upload("image", fs.createReadStream(chemin), {
      filename: fichier,
    });
    assets[champ] = asset._id;
    console.log(`  ${champ} : ${asset._id} (ratio ${ratio})`);
  }

  const set = {};
  if (fiche.familles) set.familles = localeString(fiche.familles);
  if (fiche.description) set.description = localeBlock(fiche.description);
  if (fiche.intensite != null) set.intensite = fiche.intensite;
  if (fiche.sillage != null) set.sillage = fiche.sillage;
  if (fiche.bestSeller != null) set.bestSeller = fiche.bestSeller;
  if (fiche.inspiredBy) set.inspiredBy = fiche.inspiredBy;
  for (const [champ, id] of Object.entries(assets)) {
    set[champ] = { _type: "image", asset: { _type: "reference", _ref: id } };
  }

  let tx = client.transaction();
  for (const doc of docs) {
    const docSet = { ...set };

    // Remplacements dans specificTwist, langue par langue.
    for (const [avant, apres] of fiche.remplacerDansTwist ?? []) {
      const twist = doc.specificTwist;
      if (!twist) continue;
      const maj = Object.fromEntries(
        Object.entries(twist)
          .filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.includes(avant))
          .map(([k, v]) => [k, v.replaceAll(avant, apres)])
      );
      if (Object.keys(maj).length) {
        docSet.specificTwist = { ...twist, ...maj };
        console.log(`  specificTwist : "${avant}" -> "${apres}" (${Object.keys(maj).join(", ")})`);
      }
    }

    console.log(`  ${doc._id} : ${Object.keys(docSet).join(", ")}${(fiche.vider ?? []).length ? ` | vidé: ${fiche.vider.join(", ")}` : ""}`);
    tx = tx.patch(doc._id, { set: docSet, unset: fiche.vider ?? [] });
  }

  if (dry) {
    console.log("  [--dry] rien écrit.");
    continue;
  }
  await tx.commit();
  console.log(`  ✓ ${docs.length} document(s) mis à jour.`);
}
