import { getCliClient } from "sanity/cli";

// npx sanity exec scripts/add-description-la-braise.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

const block = (text) => ({
  _type: "block",
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", text }],
});

const bullet = (text) => ({
  _type: "block",
  style: "normal",
  listItem: "bullet",
  level: 1,
  markDefs: [],
  children: [{ _type: "span", text }],
});

await client
  .patch("parfum-reflet-n-1-la-braise")
  .set({
    description: {
      fr: [
        block(
          "La Braise est un extrait dosé à 30%, pensé pour un sillage dense et une tenue longue durée — un parfum de soirée, pas de passage."
        ),
        block("Ce qui rend La Braise différente :"),
        bullet("Concentration extrait (30% d'huiles parfumantes)"),
        bullet("4 semaines de macération et maturation"),
        bullet("Flacon en verre soufflé, plaque en laiton gravée à la main"),
      ],
    },
  })
  .commit();
console.log("✓ Description de test ajoutée à La Braise");
