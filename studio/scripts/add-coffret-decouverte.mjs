import { getCliClient } from "sanity/cli";

// npx sanity exec scripts/add-coffret-decouverte.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

await client.createOrReplace({
  _id: "coffret-sample-box",
  _type: "coffret",
  shopifyHandle: "sample-box",
  nomAffiche: "Coffret découverte",
  titre: { fr: "Coffret découverte", en: "Discovery box", ar: "علبة الاكتشاف" },
  description: {
    fr: "Un échantillon de chaque parfum de la collection, pour découvrir les 6 Reflets avant de choisir le sien.",
  },
  ordre: 1,
});
console.log("✓ Coffret découverte créé dans Sanity");
