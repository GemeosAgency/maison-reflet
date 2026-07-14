import { defineType, defineField } from "sanity";

/** Page de contenu libre (La Maison, etc.), titre et contenu localisés. */
export default defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "localeString",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title.fr" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "content", title: "Contenu", type: "localeBlock" }),
    defineField({
      name: "faqs",
      title: "FAQ",
      description: "Questions fréquentes affichées sur cette page. Choisis lesquelles et dans quel ordre.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "faq" }] }],
    }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
  ],
  preview: {
    select: { title: "title.fr", subtitle: "slug.current" },
  },
});
