/**
 * Vérifie l'assemblage de la connaissance de Luma (src/lib/luma/knowledge.ts).
 *
 *  1. Fixtures : un catalogue inventé qui couvre les cas qui comptent —
 *     rupture d'une variante, produit nouveau sans fiche éditoriale, fiche
 *     Sanity sans produit Shopify (doit disparaître), coffret, deux marchés.
 *  2. `--live` : Shopify et Sanity réels, pour les Émirats en français et la
 *     France en anglais ; chaque description passe ensuite les garde-fous avec
 *     les nombres et délais que la connaissance autorise — c'est la chaîne
 *     complète, telle que la route l'utilisera.
 *
 * Lancement : node scripts/luma-knowledge-test.mjs [--live]
 */

import { register } from "node:module";

// Le code du site importe sans extension : voir scripts/lib/ts-resolve-hooks.mjs.
register("./lib/ts-resolve-hooks.mjs", import.meta.url);
const { buildKnowledge } = await import("../src/lib/luma/knowledge.ts");
const { checkNumbers, checkOutput } = await import("../src/lib/luma/guardrails.ts");
const { getCountry } = await import("../src/lib/markets.ts");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "ok   " : "ÉCHEC"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

/* ------------------------------------------------------------ fixtures */

const money = (amount) => ({ amount: String(amount), currencyCode: "AED" });
const variant = (id, title, amount, availableForSale = true) => ({
  id, title, sku: null, availableForSale, price: money(amount), image: null, selectedOptions: [],
});
const product = (handle, title, variants, extra = {}) => ({
  id: `gid://shopify/Product/${handle}`, handle, title, description: "", descriptionHtml: "",
  productType: "", category: null, featuredImage: null, images: { nodes: [] },
  priceRange: { minVariantPrice: variants[0].price, maxVariantPrice: variants[0].price },
  variants: { nodes: variants }, ...extra,
});

const PRODUCTS = [
  product("sample-box", "Discovery Box", [variant("v-box", "Default Title", 160)], { productType: "coffret" }),
  product("new-oud", "New Oud", [variant("v-no-75", "75 ml", 320, false), variant("v-no-2", "2 ml", 15)]),
  product("eclat-de-nuit", "Éclat de Nuit", [variant("v-en-75", "75 ml", 320)]),
  product("bois-alert", "Bois Alert", [variant("v-ba-75", "75 ml", 320), variant("v-ba-2", "2 ml", 15)]),
];

const DOCS = [
  {
    shopifyHandle: "bois-alert", inspiredBy: "Bois Impérial", bestSeller: true, familles: "Boisé, Aérien",
    description: "Nous avons réinterprété l'ADN boisé de Bois Impérial — Essential Parfums, enrichi des facettes de Baccarat Rouge 540.",
    notes: { tete: ["Poivre noir", "Safran", "Bergamote de Calabre"], coeur: ["Jasmin Sambac"], fond: ["Vétiver"] },
  },
  {
    shopifyHandle: "new-oud", inspiredBy: "Oud Maracuja", bestSeller: null, familles: null,
    description: "Nous avons réinterprété l'ADN moderne d'Oud Maracuja — Maison Crivelli.",
    notes: { tete: ["Fruit de la passion"], coeur: ["Rose de Taïf"], fond: ["Oud"] },
  },
  // Fiche fantôme : plus aucun produit Shopify derrière — ne doit pas apparaître.
  { shopifyHandle: "la-lune", inspiredBy: "Blanche", bestSeller: null, familles: null, description: "Ancienne collection.", notes: { tete: [], coeur: [], fond: [] } },
];

console.log("Fixtures — Émirats, français");
const ae = buildKnowledge({ products: PRODUCTS, parfums: DOCS, country: getCountry("AE"), locale: "fr", now: new Date("2026-09-10T08:00:00Z") });
const handles = ae.products.map((p) => p.handle);
check("Shopify fait foi : la-lune absente", !handles.includes("la-lune"));
check("ordre : best-seller, persona, nouveauté, coffret", handles.join(",") === "bois-alert,new-oud,eclat-de-nuit,sample-box", handles.join(","));
check("coffret détecté par productType", ae.products.at(-1).kind === "coffret");
check("nom du coffret localisé (fr)", ae.products.at(-1).name === "Coffret découverte", ae.products.at(-1).name);
const ba = ae.products[0];
check("twist et essence depuis collection.ts", ba.twistOf?.startsWith("Bois Impérial") && Boolean(ba.essence));
check("description Sanity transmise", ba.description?.includes("Baccarat Rouge 540"));
check("notes Sanity transmises", ba.notes?.tete.length === 3);
check("échantillon repéré", ba.variants.some((v) => v.sample && v.price === 15) && ba.variants.some((v) => !v.sample && v.price === 320));
const no = ae.products[1];
check("rupture du 75 ml visible, échantillon disponible", no.variants.find((v) => !v.sample).available === false && no.available === true);
check("bestSeller null → false", no.bestSeller === false);
const nouveau = ae.products[2];
check("produit inconnu : présent, sans histoire inventée", nouveau.kind === "parfum" && nouveau.twistOf === null && nouveau.essence === null && nouveau.description === null && nouveau.notes === null);
check("allowedHandles = catalogue Shopify", ae.allowedHandles.join(",") === handles.join(","));
check("devise pratiquée AED", ae.logistics.currency === "AED");
check("logistique Émirats : 400 / 25 / 1-2 jours / jour même exposé", ae.logistics.freeShippingThreshold === 400 && ae.logistics.shippingRate === 25 && ae.allowedDelays.join("-") === "1-2" && ae.logistics.sameDayDubai !== null);
for (const n of [320, 160, 15, 540, 400, 25]) check(`allowedNumbers contient ${n}`, ae.allowedNumbers.includes(n));

console.log("\nFixtures — Arabie saoudite, anglais (Shopify répond encore en AED)");
const sa = buildKnowledge({ products: PRODUCTS, parfums: DOCS, country: getCountry("SA"), locale: "en" });
check("devise = celle des prix, pas du marché espéré", sa.logistics.currency === "AED");
check("seuil et frais dans la devise pratiquée : 400 / 70", sa.logistics.freeShippingThreshold === 400 && sa.logistics.shippingRate === 70);
check("délais Golfe 3-5, pas de jour même", sa.allowedDelays.join("-") === "3-5" && sa.logistics.sameDayDubai === null);
check("nom du coffret localisé (en)", sa.products.at(-1).name === "Discovery box", sa.products.at(-1).name);

console.log("\nFixtures — garde-fous nourris par la connaissance");
check("prix connu accepté", checkNumbers("Le 75 ml est à 320 AED, le coffret à 160 AED.", ae.allowedNumbers, ae.allowedDelays).length === 0);
check("délai du site accepté (AE)", checkNumbers("Livré en 1 à 2 jours ouvrés.", ae.allowedNumbers, ae.allowedDelays).length === 0);
check("délai d'un autre marché refusé (AE)", checkNumbers("Comptez 3 à 5 jours.", ae.allowedNumbers, ae.allowedDelays).length > 0);
check("prix inventé refusé", checkNumbers("Le flacon est à 290 AED.", ae.allowedNumbers, ae.allowedDelays).length > 0);

/* ---------------------------------------------------------------- live */

if (process.argv.includes("--live")) {
  const { liveKnowledge } = await import("./lib/live-knowledge.mjs");

  for (const [country, locale] of [["AE", "fr"], ["FR", "en"]]) {
    console.log(`\nLive — ${country}, ${locale}`);
    const k = await liveKnowledge(country, locale);
    for (const p of k.products) {
      const main = p.variants.find((v) => !v.sample) ?? p.variants[0];
      console.log(
        `  ${p.kind.padEnd(7)} ${p.name.padEnd(18)} ${String(main?.price).padStart(5)} ${main?.currency}` +
          `  ${p.available ? "dispo" : "RUPTURE"}  twist:${p.twistOf ? "oui" : "—"} desc:${p.description ? p.description.length + "c" : "—"}` +
          ` notes:${p.notes ? p.notes.tete.length + "/" + p.notes.coeur.length + "/" + p.notes.fond.length : "—"}` +
          (p.bestSeller ? "  ★" : "")
      );
      if (p.description) {
        const v = [...checkOutput(p.description), ...checkNumbers(p.description, k.allowedNumbers, k.allowedDelays)];
        check(`    description de ${p.name} passe les garde-fous`, v.length === 0, JSON.stringify(v));
      }
    }
    const L = k.logistics;
    console.log(`  logistique : ${L.currency} · offerte dès ${L.freeShippingThreshold} · port ${L.shippingRate} · ${L.deliveryDays.min}-${L.deliveryDays.max} j` +
      (L.sameDayDubai ? ` · jour même Dubaï ${L.sameDayDubai.open ? "ouvert" : "fermé"}` : ""));
    console.log(`  ${k.allowedNumbers.length} nombres autorisés, délais ${k.allowedDelays.join("-")}`);
    check("au moins six parfums et deux coffrets", k.products.filter((p) => p.kind === "parfum").length >= 6 && k.products.filter((p) => p.kind === "coffret").length >= 2);
    check("tous les parfums connus ont twist + description + notes", k.products.filter((p) => p.kind === "parfum" && p.twistOf).every((p) => p.description && p.notes));
  }
}

console.log(failures ? `\n${failures} échec(s).` : "\nTout passe.");
process.exit(failures ? 1 : 0);
