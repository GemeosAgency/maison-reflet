import { defineType } from "sanity";
import { languages, baseLanguage } from "./languages";

/** Texte riche (Portable Text) traduisible (fr/ar/en). */
export default defineType({
  name: "localeBlock",
  title: "Contenu riche (localisé)",
  type: "object",
  fieldsets: [
    { name: "translations", title: "Traductions", options: { collapsible: true, collapsed: false } },
  ],
  fields: languages.map((lang) => ({
    name: lang.id,
    title: lang.title,
    type: "array",
    of: [{ type: "block" }, { type: "image", options: { hotspot: true } }],
    fieldset: lang.id === baseLanguage.id ? undefined : "translations",
  })),
});
