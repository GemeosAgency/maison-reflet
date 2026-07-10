import { getCliClient } from "sanity/cli";

// npx sanity exec scripts/add-coffret-6-reflets.mjs --with-user-token
const client = getCliClient({ apiVersion: "2025-01-01" });

const parfumRefs = (...handles) =>
  handles.map((h, i) => ({ _type: "reference", _ref: `parfum-${h}`, _key: `${h}${i}` }));

await client.createOrReplace({
  _id: "coffret-all-6-perfums-box",
  _type: "coffret",
  shopifyHandle: "all-6-perfums-box",
  nomAffiche: "Les 6 Reflets",
  titre: { fr: "Les 6 Reflets", en: "The 6 Reflets", ar: "الانعكاسات الستة" },
  description: {
    fr: "La collection complète : les six parfums de la Maison, pour vivre chaque reflet dans son intégralité.",
  },
  parfums: parfumRefs(
    "reflet-n-1-la-braise",
    "reflet-n-2-leclipse",
    "reflet-n-3-rosee",
    "reflet-n-4-azur",
    "reflet-n-5-le-zenith",
    "la-lune"
  ),
  ordre: 2,
});
console.log("✓ Coffret Les 6 Reflets créé dans Sanity");
