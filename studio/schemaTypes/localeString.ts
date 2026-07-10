import { defineType } from "sanity";
import { languages, baseLanguage } from "./languages";

/** Chaîne courte traduisible (fr/ar/en). Requête : champ.fr, champ.ar… */
export default defineType({
  name: "localeString",
  title: "Texte court (localisé)",
  type: "object",
  fieldsets: [
    { name: "translations", title: "Traductions", options: { collapsible: true, collapsed: false } },
  ],
  fields: languages.map((lang) => ({
    name: lang.id,
    title: lang.title,
    type: "string",
    fieldset: lang.id === baseLanguage.id ? undefined : "translations",
  })),
});
