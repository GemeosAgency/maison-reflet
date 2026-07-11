import { getCliClient } from "sanity/cli";

// Initialise le nouveau champ "reassurancesCta" (liste compacte sous le CTA) avec
// les mêmes valeurs que le bandeau existant "reassurances", pour ne rien casser
// visuellement le temps que chaque fiche soit personnalisée dans le Studio.
// npx sanity exec scripts/init-reassurances-cta.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

const parfums = await client.fetch(`*[_type == "parfum" && defined(reassurances)]{ _id, reassurances }`);
for (const p of parfums) {
  await client.patch(p._id).set({ reassurancesCta: p.reassurances }).commit();
  console.log("✓", p._id);
}
console.log(`\n${parfums.length} fiches initialisées`);
