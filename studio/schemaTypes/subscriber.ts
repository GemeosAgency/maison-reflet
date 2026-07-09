import { defineType, defineField } from "sanity";

/** Schéma "subscriber" : inscrits à la liste d'attente (teaser Bientôt) */
export default defineType({
  name: "subscriber",
  title: "Inscrit (liste d'attente)",
  type: "document",
  fields: [
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "createdAt",
      title: "Inscrit le",
      type: "datetime",
    }),
    defineField({
      name: "source",
      title: "Source",
      type: "string",
      description: "D'où vient l'inscription (ex: teaser)",
    }),
  ],
  orderings: [
    {
      title: "Plus récents d'abord",
      name: "createdAtDesc",
      by: [{ field: "createdAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "email", subtitle: "createdAt" },
  },
});
