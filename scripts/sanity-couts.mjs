/**
 * Écrit les coûts de revient unitaires dans Sanity.
 *
 * Un coût = ce que coûte UNE unité, tout compris (jus, flacon, bouchon,
 * étiquette, étui, remplissage, transport et douane jusqu'à Dubaï). Ni la
 * livraison au client, ni les frais de paiement, ni la publicité : ce sont des
 * coûts par commande ou de période, pas par unité.
 *
 *   node scripts/sanity-couts.mjs --dry
 *   node scripts/sanity-couts.mjs
 */
import { createClient } from "@sanity/client";

const DRY = process.argv.includes("--dry");
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET ?? "production",
  apiVersion: process.env.SANITY_API_VERSION ?? "2025-01-01",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

// Sandro, 17 septembre 2026. Provisoires : à reprendre quand les factures du
// premier réappro seront connues.
const COUTS = {
  "ultra-cuir": 60,
  "minuit-bourbon": 60,
  "new-oud": 60,
  "bois-alert": 60,
  "melting-mango": 60,
  "fifth-season": 60,
  "sample-box": 24,
};

const docs = await client.fetch(
  `*[_type in ["parfum","coffret"] && defined(shopifyHandle)]{_id, shopifyHandle, coutRevient}`
);
console.log(`${docs.length} fiches trouvées.`);
for (const d of docs) {
  const cout = COUTS[d.shopifyHandle];
  if (cout === undefined) {
    console.log(`  ${d.shopifyHandle} : pas de coût fourni, laissé vide`);
    continue;
  }
  if (DRY) {
    console.log(`  ${d.shopifyHandle} : ${d.coutRevient ?? "vide"} → ${cout} AED`);
    continue;
  }
  for (const id of [d._id, `drafts.${d._id}`]) {
    try {
      await client.patch(id).set({ coutRevient: cout }).commit();
    } catch (e) {
      if (!/not found|does not exist/i.test(String(e))) throw e;
    }
  }
  console.log(`  ${d.shopifyHandle} : ${cout} AED`);
}
