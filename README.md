# Maison Reflet — Site headless Astro + Shopify + Sanity

Stack : **Astro** (frontend, déployé sur Vercel) + **Shopify** (commerce : catalogue, panier, checkout) + **Sanity** (contenu éditorial : storytelling, notes olfactives, inspiration culturelle).

Le principe : Shopify reste la source de vérité pour tout ce qui touche au commerce (prix, stock, checkout). Sanity enrichit chaque produit avec du contenu de marque, relié via le `handle` Shopify. Astro assemble les deux au moment du build.

---

## 0. Ce qui est déjà scaffoldé

- `src/lib/shopify.ts` — client Storefront API (produits, panier : `createCart`, `getCart`, `addCartLine`, `removeCartLine`)
- `src/lib/sanity.ts` — client Sanity (contenu éditorial)
- `src/lib/cart.ts` — état du panier côté client (id du panier en localStorage, Shopify reste la source de vérité)
- `src/components/AddToCartButton.astro` — bouton d'ajout au panier (avec sélecteur de variante)
- `src/pages/index.astro` — page d'accueil (hero, parfums phares, identité de la Maison)
- `src/pages/parfums/index.astro` — listing de la collection
- `src/pages/parfums/[handle].astro` — page produit (Shopify + Sanity combinés)
- `src/pages/panier.astro` — panier (rendu côté client) + lien vers le checkout Shopify
- `src/pages/maison.astro` — page "La Maison" (contenu Sanity type `page`, slug `maison`)
- `studio/` — Sanity Studio avec 2 schémas : `parfum` (contenu éditorial) et `page` (pages libres)

Ce qui reste à faire avant que ça tourne : créer les comptes Shopify et Sanity, et remplir les variables d'environnement (`.env` à la racine, voir `.env.example`).

---

## 1. Créer la boutique Shopify

1. Créer un compte sur [shopify.com](https://www.shopify.com) (essai gratuit possible)
2. Dans l'admin, aller dans **Réglages > Apps et canaux de vente**
3. Cliquer sur **Développer des apps** puis **Créer une app**
4. Nommer l'app (ex: "Maison Reflet Storefront")
5. Dans l'onglet **Storefront API**, activer les scopes nécessaires au minimum :
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_checkouts`
   - `unauthenticated_write_checkouts` (**indispensable** : les mutations de la Cart API — création du panier, ajout/retrait de lignes — échouent sans ce scope d'écriture)
6. Installer l'app, puis récupérer le **token Storefront API** (pas le token Admin, ils sont différents)
7. Créer les produits de la collection "Les 10 Reflets" dans l'admin Shopify (titre, prix, variantes, images, description courte)

Le `handle` de chaque produit (visible dans l'URL du produit côté admin) devra être identique au `shopifyHandle` que tu renseigneras dans Sanity — c'est le lien entre les deux systèmes.

## 2. Créer le projet Sanity

1. Créer un compte sur [sanity.io](https://www.sanity.io)
2. Depuis `studio/`, lancer :
   ```bash
   cd studio
   npm install sanity @sanity/vision react react-dom styled-components
   npx sanity init
   ```
3. Choisir "Create new project", donner un nom ("Maison Reflet"), dataset `production`
4. Récupérer le `projectId` affiché (aussi visible sur [sanity.io/manage](https://sanity.io/manage))
5. Renseigner le `projectId` côté Studio : soit remplacer `REMPLACER_PROJECT_ID` dans `studio/sanity.config.ts`, soit créer un fichier `studio/.env` avec `SANITY_STUDIO_PROJECT_ID=<projectId>` (et `SANITY_STUDIO_DATASET=production` si différent)
6. Lancer le Studio en local pour vérifier que ça fonctionne :
   ```bash
   npm run dev
   ```
   Le Studio s'ouvre sur `http://localhost:3333`
7. Créer une fiche `parfum` par produit, avec le `shopifyHandle` correspondant exactement au handle Shopify

## 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Remplir toutes les valeurs (voir commentaires dans `.env.example` pour où les trouver).

## 4. Lancer le site en local

Depuis la racine du projet (pas `studio/`) :

```bash
npm install
npm run dev
```

Le site est disponible sur `http://localhost:4321`.

## 5. Déployer sur Vercel

1. Pousser le repo sur GitHub
2. Sur [vercel.com](https://vercel.com), importer le repo
3. Renseigner les variables d'environnement (les mêmes que `.env`) dans les réglages du projet Vercel
4. Déployer — Vercel détecte automatiquement Astro grâce à l'adapter déjà configuré

Le Sanity Studio (`studio/`) peut être déployé séparément sur Sanity (`npx sanity deploy` depuis `studio/`) ou sur un second projet Vercel — à décider selon si tu veux que l'équipe édite via une URL dédiée type `maison-reflet.sanity.studio`.

---

## Prochaines étapes de développement

Dans l'ordre logique pour continuer le build (idéal à faire avec Claude Code en local, sur ce repo) :

1. ~~**Flux panier**~~ ✅ fait : bouton "Ajouter au panier" branché sur la Cart API (`src/lib/cart.ts` + `src/components/AddToCartButton.astro`), panier persistant via localStorage, page `/panier` avec lien vers le `checkoutUrl` Shopify
2. ~~**Page d'accueil**~~ ✅ fait : hero de marque, 3 parfums phares tirés de Shopify, storytelling de la Maison
3. ~~**Page "La Maison"**~~ ✅ fait : `/maison` rend le document Sanity `page` de slug `maison` (Portable Text via `@portabletext/to-html`)
4. **Design system** : typographie, palette, composants réutilisables (actuellement le HTML est non stylé, juste fonctionnel)
5. **Internationalisation** : si ciblage GCC + France, prévoir FR/AR/EN — Astro i18n natif ou Sanity localization selon le volume de contenu traduit
6. **SEO** : meta tags dynamiques par produit, sitemap, données structurées Product (Schema.org) pour le rich snippet prix/stock dans Google
7. **Preview mode Sanity** : pour prévisualiser le contenu en brouillon avant publication (nécessite `SANITY_READ_TOKEN` + `useCdn: false`)

## Notes techniques importantes

- **Rendu SSG par défaut** : les pages produits sont générées au build. Si le stock ou les prix changent souvent, il faudra soit redéployer fréquemment (webhook Shopify → Vercel deploy hook), soit passer certaines routes en mode `server` pour du rendu à la demande.
- **Rate limits Storefront API** : les requêtes au build sont généralement safe, mais si tu ajoutes du fetch runtime (ex: stock en temps réel), prévoir du caching.
- **Versions API à surveiller** : `PUBLIC_SHOPIFY_API_VERSION` expire après ~1 an, à mettre à jour tous les 3 mois par sécurité.
- **Variables Shopify préfixées `PUBLIC_`** : le token Storefront est public par conception (lecture + panier, rate-limité) ; le préfixe permet au flux panier d'appeler la Cart API directement depuis le navigateur. Le token Admin, lui, ne doit jamais apparaître dans ces variables.
