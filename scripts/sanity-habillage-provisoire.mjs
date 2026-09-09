/**
 * Habillage provisoire des fiches produit, en attendant le shooting.
 *
 * État constaté (septembre 2026) : seul Bois Brouge dispose de photos du
 * NOUVEAU packaging. Les 5 autres parfums portent encore, dans Sanity, des
 * visuels de l'ancienne génération de flacon (autre forme, étiquette dorée
 * ornementée, jus colorés) — deux designs de flacon coexistaient donc sur le
 * site.
 *
 * Ce script fait deux choses :
 *
 * 1. imagesEditoriales — recopie les photos de Bois Brouge sur les 5 autres
 *    parfums. C'est de l'habillage assumé : sur l'une d'elles l'étiquette
 *    "BOIS BROUGE" est lisible. À remplacer après le shooting.
 *
 *    Le jeu source contenait aussi un flacon étiqueté IMPERIAL ARMENIA, qui
 *    n'avait rien à faire là ; il a été retiré des 6 fiches. Si tu remets des
 *    photos dans Bois Brouge, vérifie l'étiquette avant de relancer.
 *
 * 2. imageRecommandation / imageRecommandationHover — vidées sur les 6. Elles
 *    alimentent les tuiles "You may also like" et étaient TOUTES de l'ancien
 *    packaging. Vidées, le code retombe sur product.featuredImage de Shopify
 *    (voir parfums/[handle].astro), c'est-à-dire le bon rendu de chaque
 *    parfum, avec la bonne étiquette. Mieux que de l'habillage.
 *
 * L'alt est volontairement retiré : le code applique alors product.title,
 * donc le nom du parfum réellement affiché plutôt que "Bois Brouge".
 *
 *   SANITY_WRITE_TOKEN=sk... node scripts/sanity-habillage-provisoire.mjs --dry
 */
import fs from "node:fs";
import { createClient } from "@sanity/client";

const SOURCE = "bois-brouge";
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

const source = await client.fetch(
  `*[_type == "parfum" && shopifyHandle == $h && !(_id in path("drafts.**"))][0]{ imagesEditoriales }`,
  { h: SOURCE }
);
const photos = source?.imagesEditoriales ?? [];
if (photos.length === 0) {
  console.error(`Aucune imagesEditoriales sur "${SOURCE}" — rien à recopier.`);
  process.exit(1);
}
console.log(`Source : ${SOURCE} — ${photos.length} photos\n`);

// Brouillons inclus : sinon une publication ultérieure réintroduirait
// l'ancien packaging par-dessus.
const docs = await client.fetch(`*[_type == "parfum"]{ _id, shopifyHandle }`);

let tx = client.transaction();
let nEdito = 0;
let nReco = 0;

for (const doc of docs) {
  const isSource = doc.shopifyHandle === SOURCE;
  const patch = { unset: ["imageRecommandation", "imageRecommandationHover"] };
  nReco += 1;

  if (!isSource) {
    // _key régénéré par document, alt retiré (repli sur product.title).
    patch.set = {
      imagesEditoriales: photos.map((p, i) => ({
        _type: p._type ?? "image",
        _key: `habillage-${i}`,
        asset: p.asset,
        ...(p.hotspot ? { hotspot: p.hotspot } : {}),
        ...(p.crop ? { crop: p.crop } : {}),
      })),
    };
    nEdito += 1;
  }

  console.log(
    `  ${doc._id}\n      reco vidée${isSource ? "" : `, ${photos.length} photos copiées`}`
  );
  tx = tx.patch(doc._id, patch);
}

if (dry) {
  console.log(`\n[--dry] ${nReco} doc(s) : reco vidée. ${nEdito} doc(s) : photos copiées. Rien écrit.`);
  process.exit(0);
}
await tx.commit();
console.log(`\n✓ ${nReco} doc(s) reco vidée, ${nEdito} doc(s) rhabillés.`);
