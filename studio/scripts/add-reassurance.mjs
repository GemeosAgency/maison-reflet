import { getCliClient } from "sanity/cli";
import fs from "node:fs";
import path from "node:path";

// npx sanity exec scripts/add-reassurance.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

async function uploadIcon(file) {
  const buf = fs.readFileSync(path.resolve(process.cwd(), "..", "public", "brand", file));
  const asset = await client.assets.upload("image", buf, { filename: file });
  return { _type: "image", asset: { _type: "reference", _ref: asset._id } };
}

const items = [
  {
    id: "livraison",
    file: "reassurance-livraison.svg",
    texte: { fr: "Livraison\nOfferte", en: "Free\nShipping", ar: "شحن\nمجاني" },
  },
  {
    id: "paiement",
    file: "reassurance-paiement.svg",
    texte: { fr: "Paiement\nSécurisé", en: "Secure\nPayment", ar: "دفع\nآمن" },
  },
  {
    id: "service-client",
    file: "reassurance-service-client.svg",
    texte: { fr: "Service Client\nRéactif", en: "Responsive\nCustomer Service", ar: "خدمة عملاء\nسريعة" },
  },
  {
    id: "echantillons",
    file: "reassurance-echantillons.svg",
    texte: { fr: "Échantillons\nOfferts", en: "Free\nSamples", ar: "عيّنات\nمجانية" },
  },
  {
    id: "cadeau",
    file: "reassurance-cadeau.svg",
    texte: { fr: "Cadeau pour votre\nPremière commande", en: "Gift for your\nFirst order", ar: "هدية\nلطلبك الأول" },
  },
];

const ids = [];
for (const item of items) {
  const icone = await uploadIcon(item.file);
  await client.createOrReplace({
    _id: `reassurance-${item.id}`,
    _type: "reassurance",
    icone,
    texte: item.texte,
  });
  ids.push(item.id);
  console.log("✓", item.id);
}

// Applique les 5 par défaut à tous les parfums existants (modifiable ensuite par fiche dans le Studio).
const refs = ids.map((id, i) => ({ _type: "reference", _ref: `reassurance-${id}`, _key: `${id}${i}` }));
const parfums = await client.fetch(`*[_type == "parfum"]{ _id }`);
for (const p of parfums) {
  await client.patch(p._id).set({ reassurances: refs }).commit();
}
console.log(`✓ Réassurance appliquée à ${parfums.length} parfums`);
