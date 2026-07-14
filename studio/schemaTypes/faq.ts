import { defineType, defineField } from "sanity";

/**
 * Question/réponse réutilisable, à rattacher (via le champ "faqs") aux fiches
 * Parfum, Coffret et/ou Pages où elle doit apparaître — même logique que les
 * blocs de réassurance : une bibliothèque commune, un choix + un ordre propre
 * à chaque fiche.
 */
export default defineType({
  name: "faq",
  title: "FAQ",
  type: "document",
  fields: [
    defineField({
      name: "question",
      title: "Question",
      type: "localeString",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "reponse",
      title: "Réponse",
      description: "Texte riche : paragraphes, listes, liens, images.",
      type: "localeBlock",
    }),
  ],
  preview: {
    select: { title: "question.fr" },
  },
});
