/**
 * Pose la photo « texte devant » (Figma 11928:1191) dans `imageRecommandation`
 * des six parfums : c'est l'image de fond des cartes produit du catalogue et de
 * l'accueil, celles dont le nom et le prix sont posés par-dessus.
 */
import { createClient } from "@sanity/client";
import { createReadStream } from "node:fs";

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: process.env.SANITY_API_VERSION || "2024-01-01",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

const DIR = process.argv[2];
const HANDLES = ["bois-alert", "new-oud", "minuit-bourbon", "melting-mango", "ultra-cuir", "fifth-season"];

const docs = await client.fetch(
  `*[_type == "parfum" && shopifyHandle in $h]{_id, shopifyHandle, nomAffiche}`,
  { h: HANDLES }
);
const brouillons = await client.fetch(`*[_id in $ids]{_id}`, { ids: docs.map((d) => `drafts.${d._id}`) });
if (brouillons.length) {
  console.error("Brouillons en attente, on ne touche à rien :", brouillons.map((b) => b._id).join(", "));
  process.exit(1);
}

for (const handle of HANDLES) {
  const doc = docs.find((d) => d.shopifyHandle === handle);
  if (!doc) { console.error("pas de document pour", handle); continue; }
  const fichier = `${DIR}/${handle}-carte.jpg`;
  const asset = await client.assets.upload("image", createReadStream(fichier), {
    filename: `${handle}-carte.jpg`,
    title: `${doc.nomAffiche ?? handle} — carte catalogue`,
  });
  await client
    .patch(doc._id)
    .set({ imageRecommandation: { _type: "image", asset: { _type: "reference", _ref: asset._id } } })
    .commit();
  console.log(handle, "→", asset._id, `${asset.metadata.dimensions.width}x${asset.metadata.dimensions.height}`);
}
