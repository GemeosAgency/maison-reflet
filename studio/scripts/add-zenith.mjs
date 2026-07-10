import { getCliClient } from "sanity/cli";

// npx sanity exec scripts/add-zenith.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

const refs = (...ids) =>
  ids.map((id, i) => ({ _type: "reference", _ref: `note-${id}`, _key: `${id}${i}` }));

await client.createOrReplace({
  _id: "parfum-reflet-n-5-le-zenith",
  _type: "parfum",
  shopifyHandle: "reflet-n-5-le-zenith",
  nomAffiche: "Reflet N°5 — Le Zénith",
  inspiredBy: "Soleil Blanc",
  accroche: { fr: "Le soleil à son sommet, immobile." },
  familleOlfactive: "Ambrée",
  couleurSignature: "#D9A441",
  histoire: {
    fr: "Le Zénith est l'heure où le soleil s'arrête au plus haut du ciel — l'instant suspendu de midi. Une bergamote solaire ouvre le parfum, éclatante ; le jasmin lumineux et l'iris s'y déploient, gorgés de lumière. En fond, un ambre doré et un bois clair prolongent la chaleur, comme un après-midi qui refuse de finir. Un parfum franc et rayonnant, plein de soleil.",
  },
  inspirationCulturelle: {
    fr: "Le zénith, c'est la lumière que partagent la Provence et le désert — le même soleil blanc sur les champs de Grasse et sur les dunes d'Arabie. Le Zénith en capture l'éclat commun.",
  },
  notesTete: refs("bergamote", "cardamome"),
  notesCoeur: refs("jasmin", "iris"),
  notesFond: refs("ambre", "santal", "musc"),
});
console.log("✓ Le Zénith créé");
