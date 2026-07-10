import { defineType, defineField } from "sanity";

/** Réglages globaux de la marque (singleton — un seul document). */
export default defineType({
  name: "settings",
  title: "Réglages",
  type: "document",
  fields: [
    defineField({
      name: "brandName",
      title: "Nom de la marque",
      type: "string",
      initialValue: "Maison Reflet",
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "baseline", title: "Baseline", type: "localeString" }),
    defineField({ name: "about", title: "À propos (court)", type: "localeText" }),
    defineField({ name: "contactEmail", title: "Email de contact", type: "string" }),
    defineField({
      name: "socials",
      title: "Réseaux sociaux",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "platform", title: "Plateforme", type: "string" }),
            defineField({ name: "url", title: "Lien", type: "url" }),
          ],
          preview: { select: { title: "platform", subtitle: "url" } },
        },
      ],
    }),
    defineField({ name: "defaultSeo", title: "SEO par défaut", type: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Réglages de la marque" }) },
});
