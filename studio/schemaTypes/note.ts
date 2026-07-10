import { defineType, defineField } from "sanity";

/**
 * Bibliothèque de matières olfactives, réutilisables entre parfums.
 * Chaque parfum référence des notes (tête / cœur / fond).
 */
export default defineType({
  name: "note",
  title: "Note olfactive",
  type: "document",
  fields: [
    defineField({
      name: "nom",
      title: "Nom",
      type: "localeString",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "famille",
      title: "Famille",
      type: "string",
      options: {
        list: [
          "Florale",
          "Boisée",
          "Orientale",
          "Épicée",
          "Ambrée",
          "Hespéridée",
          "Musquée",
          "Aromatique",
          "Autre",
        ],
      },
    }),
    defineField({ name: "histoire", title: "Histoire de la matière", type: "localeText" }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: { title: "nom.fr", subtitle: "famille", media: "image" },
  },
});
