import { defineType, defineField } from "sanity";

/**
 * Bibliothèque d'arguments de réassurance (icône + texte), réutilisables entre
 * parfums — ex : livraison offerte, paiement sécurisé, échantillons offerts.
 * Chaque parfum choisit ensuite lesquels afficher, et dans quel ordre.
 */
export default defineType({
  name: "reassurance",
  title: "Réassurance",
  type: "document",
  fields: [
    defineField({
      name: "icone",
      title: "Icône",
      type: "image",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "texte",
      title: "Texte",
      type: "localeText",
      description: "Un retour à la ligne = une ligne affichée (ex : « Livraison\\nOfferte »).",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { title: "texte.fr", media: "icone" },
  },
});
