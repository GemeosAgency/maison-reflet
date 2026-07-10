import { getCliClient } from "sanity/cli";
import fs from "node:fs";
import path from "node:path";

// À exécuter : npx sanity exec scripts/products.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

const refs = (...ids) =>
  ids.map((id, i) => ({ _type: "reference", _ref: `note-${id}`, _key: `${id}${i}` }));

async function uploadGallery(file) {
  const buf = fs.readFileSync(path.resolve(process.cwd(), "..", "public", "brand", file));
  const asset = await client.assets.upload("image", buf, { filename: file });
  return [{ _type: "image", _key: "g1", asset: { _type: "reference", _ref: asset._id } }];
}

// 1. "Inspiré de" sur les parfums existants (patch : ne touche pas au reste).
await client.patch("parfum-reflet-n-1-la-braise").set({ inspiredBy: "Baccarat Rouge 540" }).commit();
await client.patch("parfum-reflet-n-2-leclipse").set({ inspiredBy: "Ombre Nomade" }).commit();
console.log("✓ inspiredBy : La Braise, L'éclipse");

// 2. Rosée
await client.createOrReplace({
  _id: "parfum-reflet-n-3-rosee",
  _type: "parfum",
  shopifyHandle: "reflet-n-3-rosee",
  nomAffiche: "Reflet N°3 — Rosée",
  inspiredBy: "Bois Impérial",
  accroche: { fr: "La rosée sur les pétales, au premier jour." },
  familleOlfactive: "Florale",
  couleurSignature: "#C98B95",
  histoire: {
    fr: "Rosée capture l'instant fragile où le jour se lève sur un jardin encore humide. Une rose de Taïf à peine ouverte retient la fraîcheur de la nuit ; le jasmin et la violette la prolongent, poudrés et tendres. En fond, un musc doux et un ambre discret enveloppent la fleur comme une étoffe. Un parfum de commencement, lumineux et intime.",
  },
  inspirationCulturelle: {
    fr: "Entre la rose de Grasse et la rose de Taïf chère à l'Orient, Rosée réunit les deux grandes cultures de la rose dans un même souffle.",
  },
  notesTete: refs("bergamote", "poivre-rose"),
  notesCoeur: refs("rose-taif", "jasmin", "violette"),
  notesFond: refs("musc", "ambre", "santal"),
  imagesEditoriales: await uploadGallery("reco-rosee.jpg"),
});
console.log("✓ Rosée");

// 3. Azur
await client.createOrReplace({
  _id: "parfum-reflet-n-4-azur",
  _type: "parfum",
  shopifyHandle: "reflet-n-4-azur",
  nomAffiche: "Reflet N°4 — Azur",
  inspiredBy: "Imagination",
  accroche: { fr: "Le bleu d'un ciel qui rejoint la mer." },
  familleOlfactive: "Hespéridée",
  couleurSignature: "#6FA0B5",
  histoire: {
    fr: "Azur s'ouvre sur une bergamote éclatante, ourlée d'une cardamome fraîche. Un iris limpide installe ensuite une clarté minérale, presque saline. Le fond — musc, santal, ambre pâle — laisse une traîne nette et lumineuse, comme l'air du large. Le parfum d'un horizon dégagé.",
  },
  inspirationCulturelle: {
    fr: "De la Méditerranée française au Golfe, Azur suit la même ligne d'horizon bleue qui relie les deux rives de la Maison.",
  },
  notesTete: refs("bergamote", "cardamome"),
  notesCoeur: refs("iris", "violette"),
  notesFond: refs("musc", "santal", "ambre"),
  imagesEditoriales: await uploadGallery("reco-azur.jpg"),
});
console.log("✓ Azur");

console.log("\nTerminé.");
