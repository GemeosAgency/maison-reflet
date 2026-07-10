import { defineType, defineField } from "sanity";

/**
 * Bibliothèque d'ingrédients (liste INCI / réglementaire), distincte des notes
 * olfactives (marketing). Réutilisable entre parfums via l'accordéon
 * "Voir tous les ingrédients" de la fiche produit.
 */
export default defineType({
  name: "ingredient",
  title: "Ingrédient",
  type: "document",
  fields: [
    defineField({
      name: "nom",
      title: "Nom (INCI)",
      type: "localeString",
      description: "Nom réglementaire de l'ingrédient (ex : Alcohol Denat., Limonene, Linalool).",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { title: "nom.fr" },
  },
});
