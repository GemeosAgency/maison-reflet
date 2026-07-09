## Contexte du projet

Site headless Maison Reflet : Astro (frontend) + Shopify (commerce, via Storefront API) + Sanity (contenu éditorial). Voir README.md pour l'architecture complète et les prochaines étapes de dev.

Points d'attention avant de coder :
- `src/lib/shopify.ts` et `src/lib/sanity.ts` centralisent tous les appels API — ne pas dupliquer les fetchs ailleurs
- Le lien entre un produit Shopify et son contenu éditorial Sanity se fait via `shopifyHandle` == handle du produit Shopify
- Le dossier `studio/` est un projet Node séparé (Sanity Studio), pas géré par la config Astro racine

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
