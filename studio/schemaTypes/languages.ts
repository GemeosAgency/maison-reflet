/** Langues du site — FR est la langue de base (source des slugs, fallback). */
export const languages = [
  { id: "fr", title: "Français", isRtl: false },
  { id: "ar", title: "العربية", isRtl: true },
  { id: "en", title: "English", isRtl: false },
] as const;

export const baseLanguage = languages[0];
