import { defineType, defineField } from "sanity";

/**
 * Contenu éditorial d'un parfum, relié au produit Shopify via shopifyHandle.
 * Champs texte traduisibles (fr/ar/en) ; notes olfactives = références vers
 * la bibliothèque de matières (type "note").
 */
export default defineType({
  name: "parfum",
  title: "Parfum",
  type: "document",
  groups: [
    { name: "contenu", title: "Contenu", default: true },
    { name: "notes", title: "Notes olfactives" },
    { name: "medias", title: "Médias" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "shopifyHandle",
      title: "Handle Shopify",
      type: "string",
      description:
        "Doit correspondre EXACTEMENT au handle du produit dans Shopify. C'est le lien entre les deux systèmes.",
      validation: (Rule) => Rule.required(),
      group: "contenu",
    }),
    defineField({
      name: "nomAffiche",
      title: "Nom (repère Studio)",
      type: "string",
      description: "Sert seulement à identifier la fiche dans le Studio.",
      group: "contenu",
    }),
    defineField({ name: "accroche", title: "Accroche", type: "localeString", group: "contenu" }),
    defineField({
      name: "description",
      title: "Description du produit",
      description: "Texte riche affiché dans l'accordéon « Description du produit » (paragraphes, listes à puces…).",
      type: "localeBlock",
      group: "contenu",
    }),
    defineField({
      name: "inspiredBy",
      title: "Inspiré de",
      type: "string",
      description: "Parfum de référence (ex : Baccarat Rouge 540). Affiché « INSPIRÉ DE … ».",
      group: "contenu",
    }),
    defineField({
      name: "blocs",
      title: "Blocs éditoriaux",
      description:
        "Sections storytelling de la page produit (titre + texte + image), affichées en alterné.",
      type: "array",
      group: "contenu",
      of: [
        {
          type: "object",
          name: "blocEditorial",
          fields: [
            defineField({ name: "titre", title: "Titre", type: "localeString" }),
            defineField({ name: "texte", title: "Texte", type: "localeText" }),
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              description: "Si vide, une image de la galerie est utilisée.",
            }),
            defineField({
              name: "imageAGauche",
              title: "Image à gauche",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: { select: { title: "titre.fr", media: "image" } },
        },
      ],
    }),
    defineField({
      name: "reassurances",
      title: "Réassurance",
      description:
        "Arguments affichés sous le bouton d'achat (livraison, paiement, échantillons…). Choisis lesquels afficher et dans quel ordre.",
      type: "array",
      group: "contenu",
      of: [{ type: "reference", to: [{ type: "reassurance" }] }],
    }),
    defineField({
      name: "familleOlfactive",
      title: "Famille olfactive",
      type: "string",
      options: {
        list: ["Florale", "Boisée", "Orientale", "Ambrée", "Épicée", "Hespéridée", "Chyprée", "Fougère"],
      },
      group: "contenu",
    }),
    defineField({ name: "parfumeur", title: "Parfumeur", type: "string", group: "contenu" }),
    defineField({
      name: "couleurSignature",
      title: "Couleur signature",
      type: "string",
      description: "Code hex (ex : #7A1E2B) — accent visuel de la page produit.",
      group: "contenu",
    }),
    defineField({
      name: "notesTete",
      title: "Notes de tête",
      type: "array",
      of: [{ type: "reference", to: [{ type: "note" }] }],
      group: "notes",
    }),
    defineField({
      name: "notesCoeur",
      title: "Notes de cœur",
      type: "array",
      of: [{ type: "reference", to: [{ type: "note" }] }],
      group: "notes",
    }),
    defineField({
      name: "notesFond",
      title: "Notes de fond",
      type: "array",
      of: [{ type: "reference", to: [{ type: "note" }] }],
      group: "notes",
    }),
    defineField({
      name: "ingredients",
      title: "Ingrédients",
      description: "Liste réglementaire affichée dans « Voir tous les ingrédients ».",
      type: "array",
      of: [{ type: "reference", to: [{ type: "ingredient" }] }],
      group: "notes",
    }),
    defineField({
      name: "imageRecommandation",
      title: "Image — « Vous aimerez aussi »",
      type: "image",
      options: { hotspot: true },
      description:
        "Image dédiée (format portrait) utilisée dans la section « Vous aimerez aussi ». Si vide, l'image du produit Shopify est utilisée.",
      group: "medias",
    }),
    defineField({
      name: "imageRecommandationHover",
      title: "Image « Vous aimerez aussi » — au survol",
      type: "image",
      options: { hotspot: true },
      description:
        "Deuxième visuel affiché au survol de la carte (ex : packaging, coffret). Si vide, l'image reste inchangée au survol.",
      group: "medias",
    }),
    defineField({
      name: "imagesEditoriales",
      title: "Galerie du parfum",
      description:
        "Images de la galerie de la page produit (empilées, dans l'ordre). Si vide, on retombe sur les images du produit Shopify.",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Texte alternatif", type: "localeString" }),
            defineField({ name: "caption", title: "Légende", type: "localeString" }),
          ],
        },
      ],
      group: "medias",
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  preview: {
    select: { title: "nomAffiche", subtitle: "shopifyHandle", media: "imagesEditoriales.0" },
  },
});
