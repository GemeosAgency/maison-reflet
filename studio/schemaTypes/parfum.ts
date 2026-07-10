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
      name: "inspiredBy",
      title: "Inspiré de",
      type: "string",
      description: "Parfum de référence (ex : Baccarat Rouge 540). Affiché « INSPIRÉ DE … ».",
      group: "contenu",
    }),
    defineField({ name: "histoire", title: "Histoire", type: "localeText", group: "contenu" }),
    defineField({
      name: "inspirationCulturelle",
      title: "Inspiration culturelle (ancrage franco-arabe)",
      type: "localeText",
      group: "contenu",
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
