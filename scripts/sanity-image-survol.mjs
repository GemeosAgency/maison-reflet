/**
 * Pose la photo de survol des tuiles catalogue (imageRecommandationHover) sur
 * les 6 parfums.
 *
 * La maquette du catalogue (node 11003:9970) montre au survol une SECONDE
 * photo : le flacon de trois quarts, ombre portée à gauche. Elle vient de
 * Figma (node 11217:830), source 1870 x 2048.
 *
 * Recadrage — la leçon de trois essais ratés :
 *
 * - La tuile est au ratio 478.6667/640, donc la fenêtre fait 1532 px de large
 *   sur les 1870 disponibles. Il reste 338 px de jeu horizontal.
 * - L'axe du flacon N'EST PAS au milieu de la photo : il est à 1112 px, soit
 *   59,5 % de la largeur. Recadrer au centre de l'image laisse donc le flacon
 *   nettement à droite dans la tuile — c'est ce que Sandro voyait.
 * - On repère l'axe sur le BOUCHON NOIR (lignes 400-500) : c'est un objet
 *   compact et symétrique, contrasté sur son fond. Ni la boîte englobante du
 *   flacon (polluée par l'ombre portée, qui part loin à gauche) ni un masque
 *   de clarté (le fond est un dégradé sombre en haut, clair en bas) ne
 *   donnent une mesure fiable.
 * - x0 idéal = 1112 - 1532/2 = 346, plafonné à 338 : on prend donc la coupe
 *   la plus à droite possible, ce qui place l'axe à 50,5 % de la tuile.
 *
 * Le recadrage est fait en amont (scratchpad) et le JPEG est passé en
 * argument, pour ne pas embarquer une dépendance image dans le repo.
 *
 *   SANITY_WRITE_TOKEN=sk... node scripts/sanity-image-survol.mjs <fichier.jpg> [--dry]
 */
import fs from "node:fs";
import { createClient } from "@sanity/client";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file || !fs.existsSync(file)) {
  console.error("Usage : node scripts/sanity-image-survol.mjs <fichier.jpg> [--dry]");
  process.exit(1);
}

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

// Brouillons compris : le Studio afficherait sinon l'ancienne image.
const docs = await client.fetch(
  `*[_type == "parfum"]{ _id, shopifyHandle, "survol": imageRecommandationHover.asset._ref } | order(_id)`
);
console.log(`${docs.length} fiches parfum`);
for (const d of docs) console.log("  ", d._id, d.shopifyHandle, d.survol ?? "(vide)");

if (dry) process.exit(0);

const asset = await client.assets.upload("image", fs.createReadStream(file), {
  filename: "flacon-trois-quarts-survol.jpg",
});
console.log("\nasset :", asset._id, asset.metadata?.dimensions);

// Pas d'alt : le code retombe alors sur product.title, donc le nom du parfum
// réellement affiché plutôt que "Bois Brouge" pour les six.
let tx = client.transaction();
for (const d of docs) {
  tx = tx.patch(d._id, (p) =>
    p.set({ imageRecommandationHover: { _type: "image", asset: { _type: "reference", _ref: asset._id } } })
  );
}
await tx.commit();
console.log(`imageRecommandationHover posée sur ${docs.length} fiches`);
