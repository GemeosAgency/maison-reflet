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
    defineField({
      name: "prevente",
      title: "Prévente",
      description:
        "Ouvre la prévente sur tout le site : bouton « Précommander », livraison remplacée par la date d'expédition. La remise se règle dans Shopify (prix barré = « Compare-at price »). Le site doit être redéployé pour prendre le changement.",
      type: "object",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "active", title: "Prévente ouverte", type: "boolean", initialValue: false }),
        defineField({
          name: "dateExpedition",
          title: "Date d'expédition",
          description: "Laisser vide tant qu'elle n'est pas fixée : le site annonce alors une expédition « dès l'arrivée des premiers flacons ».",
          type: "date",
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Réglages de la marque" }) },
});
