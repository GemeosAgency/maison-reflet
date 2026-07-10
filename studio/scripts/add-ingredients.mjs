import { getCliClient } from "sanity/cli";

// npx sanity exec scripts/add-ingredients.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

// Base EDP générique + allergènes IFRA les plus courants — à ajuster par parfum
// une fois la formule exacte de chaque jus connue.
const items = [
  { id: "alcohol-denat", nom: "Alcohol Denat." },
  { id: "aqua", nom: "Aqua (Water)" },
  { id: "parfum", nom: "Parfum (Fragrance)" },
  { id: "limonene", nom: "Limonene" },
  { id: "linalool", nom: "Linalool" },
  { id: "citral", nom: "Citral" },
  { id: "geraniol", nom: "Geraniol" },
  { id: "citronellol", nom: "Citronellol" },
  { id: "eugenol", nom: "Eugenol" },
  { id: "coumarin", nom: "Coumarin" },
  { id: "benzyl-benzoate", nom: "Benzyl Benzoate" },
  { id: "benzyl-salicylate", nom: "Benzyl Salicylate" },
];

const ids = [];
for (const item of items) {
  await client.createIfNotExists({
    _id: `ingredient-${item.id}`,
    _type: "ingredient",
    nom: { fr: item.nom, en: item.nom, ar: item.nom },
  });
  ids.push(item.id);
  console.log("✓", item.nom);
}

const refs = ids.map((id, i) => ({ _type: "reference", _ref: `ingredient-${id}`, _key: `${id}${i}` }));
const parfums = await client.fetch(`*[_type == "parfum"]{ _id }`);
for (const p of parfums) {
  await client.patch(p._id).set({ ingredients: refs }).commit();
}
console.log(`✓ Ingrédients appliqués à ${parfums.length} parfums`);
