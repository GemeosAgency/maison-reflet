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
      name: "contenance",
      title: "Contenance",
      type: "localeString",
      description:
        "Ligne affichée entre deux filets sous la description, ex. « 6 x 2 ML individual samples ». Laisser vide pour ne pas l'afficher.",
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "perfumerWord",
      title: "Le mot du parfumeur",
      type: "localeText",
      description: "Citation affichée à droite de la photo. Laisser vide pour masquer la section.",
    }),
    defineField({
      name: "perfumerPhoto",
      title: "Photo — mot du parfumeur",
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
    defineField({
      name: "faqs",
      title: "FAQ",
      description: "Questions fréquentes affichées sur cette fiche. Choisis lesquelles et dans quel ordre.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "faq" }] }],
    }),
  ],
  preview: {
    select: { title: "nomAffiche", subtitle: "shopifyHandle", media: "image" },
  },
});
