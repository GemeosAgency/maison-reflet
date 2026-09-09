/**
 * Repointe le champ `shopifyHandle` des documents parfum après le renommage
 * des produits Shopify (septembre 2026).
 *
 * Pourquoi ce script existe : le lien entre un produit Shopify et son contenu
 * éditorial Sanity est le champ `shopifyHandle` (voir CLAUDE.md). Renommer le
 * handle côté Shopify casse ce lien SANS erreur — `getParfumContent()` renvoie
 * simplement null et la fiche s'affiche vide. Il faut donc repointer.
 *
 * SANITY_READ_TOKEN est en lecture seule : ce script a besoin d'un token avec
 * la permission "update" (Sanity → API → Tokens → rôle Editor).
 *
 *   SANITY_WRITE_TOKEN=sk... node scripts/sanity-repointer-handles.mjs --dry
 *   SANITY_WRITE_TOKEN=sk... node scripts/sanity-repointer-handles.mjs
 */
import fs from "node:fs";
import { createClient } from "@sanity/client";

const MAP = {
  "reflet-n-1-la-braise": "bois-brouge",
  "reflet-n-2-leclipse": "new-oud",
  "reflet-n-3-rosee": "harmony-fizzy",
  "reflet-n-4-azur": "red-shadow",
  "reflet-n-5-le-zenith": "imperial-armenia",
  "la-lune": "fifth-season",
};

const dry = process.argv.includes("--dry");

// .env n'est pas chargé automatiquement hors Astro : on le lit à la main.
const env = { ...process.env };
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const token = env.SANITY_WRITE_TOKEN;
if (!token) {
  console.error("SANITY_WRITE_TOKEN manquant (rôle Editor requis, pas le read token).");
  process.exit(1);
}

const client = createClient({
  projectId: env.SANITY_PROJECT_ID,
  dataset: env.SANITY_DATASET,
  apiVersion: env.SANITY_API_VERSION,
  token,
  useCdn: false,
});

// Pas de perspective ici : on veut patcher les brouillons AUSSI, sinon une
// publication ultérieure réécrirait l'ancien handle par-dessus.
const docs = await client.fetch(`*[_type == "parfum"]{ _id, shopifyHandle }`);

let tx = client.transaction();
let n = 0;
for (const doc of docs) {
  const next = MAP[doc.shopifyHandle];
  if (!next) {
    console.log(`— ignoré : ${doc._id} (handle "${doc.shopifyHandle}" hors table)`);
    continue;
  }
  console.log(`  ${doc._id}\n      ${doc.shopifyHandle} → ${next}`);
  tx = tx.patch(doc._id, { set: { shopifyHandle: next } });
  n += 1;
}

if (n === 0) {
  console.log("\nRien à faire — tous les handles sont déjà à jour.");
  process.exit(0);
}
if (dry) {
  console.log(`\n[--dry] ${n} document(s) seraient patchés. Rien n'a été écrit.`);
  process.exit(0);
}

await tx.commit();
console.log(`\n✓ ${n} document(s) patchés.`);
