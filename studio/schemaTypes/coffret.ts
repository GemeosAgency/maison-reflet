import { defineType, defineField } from "sanity";

/**
 * Contenu éditorial d'un coffret (set multi-parfums), relié au produit Shopify
 * via shopifyHandle. Distinct du type "parfum" : pas de notes olfactives ni
 * d'accroche individuelle, juste la présentation du set et les parfums inclus.
 * Côté Shopify, le produit correspondant doit avoir le "Type de produit" = "Coffret".
 */
export default defineType({
  name: "coffret",
  title: "Coffret",
  type: "document",
  fields: [
    defineField({
      name: "shopifyHandle",
      title: "Handle Shopify",
      type: "string",
      description:
        "Doit correspondre EXACTEMENT au handle du produit dans Shopify. C'est le lien entre les deux systèmes.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "nomAffiche",
      title: "Nom (repère Studio)",
      type: "string",
      description: "Sert seulement à identifier la fiche dans le Studio.",
    }),
    defineField({ name: "titre", title: "Titre", type: "localeString" }),
    defineField({ name: "description", title: "Description", type: "localeText" }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "parfums",
      title: "Parfums inclus",
      type: "array",
      of: [{ type: "reference", to: [{ type: "parfum" }] }],
    }),
    defineField({
      name: "ordre",
      title: "Ordre d'affichage",
      type: "number",
      description: "Les coffrets s'affichent du plus petit au plus grand nombre.",
    }),
  ],
  preview: {
    select: { title: "nomAffiche", subtitle: "shopifyHandle", media: "image" },
  },
});
