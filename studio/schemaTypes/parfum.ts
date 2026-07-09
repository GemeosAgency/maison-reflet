import { defineType, defineField } from "sanity";

/**
 * Schéma "parfum" : contenu éditorial enrichissant un produit Shopify.
 * Le lien se fait via shopifyHandle, qui doit être identique au handle
 * (slug) du produit correspondant dans Shopify.
 */
export default defineType({
  name: "parfum",
  title: "Parfum",
  type: "document",
  fields: [
    defineField({
      name: "shopifyHandle",
      title: "Handle Shopify",
      type: "string",
      description:
        "Doit correspondre exactement au handle (slug) du produit dans Shopify. C'est ce qui relie ce contenu au produit.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "nomAffiche",
      title: "Nom affiché (repère éditorial uniquement)",
      type: "string",
      description: "Sert seulement à identifier le document dans le Studio, n'affecte pas le site.",
    }),
    defineField({
      name: "histoire",
      title: "Histoire du parfum",
      type: "text",
      rows: 6,
    }),
    defineField({
      name: "notesOlfactives",
      title: "Notes olfactives",
      type: "object",
      fields: [
        defineField({
          name: "tete",
          title: "Notes de tête",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "coeur",
          title: "Notes de cœur",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "fond",
          title: "Notes de fond",
          type: "array",
          of: [{ type: "string" }],
        }),
      ],
    }),
    defineField({
      name: "inspirationCulturelle",
      title: "Inspiration culturelle (ancrage franco-arabe)",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "imagesEditoriales",
      title: "Images éditoriales",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
  ],
  preview: {
    select: {
      title: "nomAffiche",
      subtitle: "shopifyHandle",
    },
  },
});
