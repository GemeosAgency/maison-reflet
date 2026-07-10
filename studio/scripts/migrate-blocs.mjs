import { getCliClient } from "sanity/cli";

// Migre histoire + inspirationCulturelle vers le nouveau champ "blocs".
// npx sanity exec scripts/migrate-blocs.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

const has = (o) => o && (o.fr || o.ar || o.en);

const parfums = await client.fetch(
  `*[_type == "parfum"]{ _id, histoire, inspirationCulturelle }`
);

for (const p of parfums) {
  const blocs = [];
  if (has(p.histoire)) {
    blocs.push({
      _type: "blocEditorial",
      _key: "histoire",
      titre: { fr: "L'histoire", en: "The story", ar: "الحكاية" },
      texte: p.histoire,
      imageAGauche: false,
    });
  }
  if (has(p.inspirationCulturelle)) {
    blocs.push({
      _type: "blocEditorial",
      _key: "inspiration",
      titre: { fr: "Inspiration", en: "Inspiration", ar: "الإلهام" },
      texte: p.inspirationCulturelle,
      imageAGauche: true,
    });
  }
  await client.patch(p._id).set({ blocs }).commit();
  console.log("✓", p._id, "→", blocs.length, "blocs");
}
console.log("\nMigration terminée.");
