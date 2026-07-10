import { defineType, defineField } from "sanity";

/** Bloc SEO réutilisable (titre/description localisés + image de partage). */
export default defineType({
  name: "seo",
  title: "Référencement (SEO)",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({ name: "metaTitle", title: "Titre meta", type: "localeString" }),
    defineField({ name: "metaDescription", title: "Description meta", type: "localeText" }),
    defineField({
      name: "ogImage",
      title: "Image de partage (réseaux sociaux)",
      type: "image",
      options: { hotspot: true },
    }),
  ],
});
