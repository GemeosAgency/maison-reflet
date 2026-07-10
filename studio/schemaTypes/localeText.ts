import { defineType } from "sanity";
import { languages, baseLanguage } from "./languages";

/** Texte long traduisible (fr/ar/en). */
export default defineType({
  name: "localeText",
  title: "Texte long (localisé)",
  type: "object",
  fieldsets: [
    { name: "translations", title: "Traductions", options: { collapsible: true, collapsed: false } },
  ],
  fields: languages.map((lang) => ({
    name: lang.id,
    title: lang.title,
    type: "text",
    rows: 5,
    fieldset: lang.id === baseLanguage.id ? undefined : "translations",
  })),
});
