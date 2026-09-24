// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

/*
 * `site` est la base de TOUTES les URLs absolues du site : canonical,
 * hreflang, Open Graph, sitemap. Sans elle, Astro produit des chemins
 * relatifs — que Google ignore pour le hreflang — et le sitemap ne peut pas
 * être généré.
 *
 * La valeur vient de PUBLIC_SITE_URL, déjà configurée par environnement sur
 * Vercel (Production et Preview/staging) : chaque déploiement s'annonce donc
 * sous son propre domaine, sans domaine codé en dur ici. Repli sur localhost
 * pour le dev, où la variable n'est pas définie.
 */
const site = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';

// Les pages en noindex (staging) ne doivent pas alimenter un sitemap.
const indexable = process.env.PUBLIC_ALLOW_INDEXING === 'true';

/*
 * Les modules partagés du navigateur prennent le nom de leur fichier source :
 * `ga4.xxxx.js`, `klaviyo.xxxx.js`, `meta.xxxx.js`… Les bloqueurs de pistage
 * (uBlock, AdGuard, Brave, Safari) coupent ces URL sur leur seul nom. Or le
 * panier les importe : un seul fichier bloqué, et tout le module de la fiche
 * tombait avec lui, sélecteur de quantité, ajout au panier et barre d'achat
 * collante compris (Sandro, 24 sept.). Ces modules-là sortent donc sous un nom
 * neutre ; le pistage peut échouer, jamais l'achat. Côté navigateur seulement :
 * le serveur garde les noms d'Astro.
 */
const TRACKING_NAME = /ga4|gtag|analytic|klaviyo|meta|pixel|track|event|ads?\b/i;

// https://astro.build/config
export default defineConfig({
  site,
  adapter: vercel(),
  vite: {
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              chunkFileNames: (chunk) =>
                TRACKING_NAME.test(chunk.name) ? '_astro/m.[hash].js' : '_astro/[name].[hash].js',
            },
          },
        },
      },
    },
  },
  integrations: [
    ...(indexable
      ? [
          sitemap({
            // Déclare les 3 versions linguistiques de chaque page : le sitemap
            // porte alors les mêmes signaux hreflang que le <head>.
            i18n: {
              defaultLocale: 'fr',
              locales: { fr: 'fr', ar: 'ar', en: 'en' },
            },
            // La racine "/" ne fait que rediriger vers la langue détectée.
            filter: (page) => new URL(page).pathname !== '/',
          }),
        ]
      : []),
  ],
});
