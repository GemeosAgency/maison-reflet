import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";
import { structure } from "./structure";

export default defineConfig({
  name: "maison-reflet",
  title: "Maison Reflet",

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "uacey1u9",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",

  plugins: [
    // Studio organisé (singleton Réglages + listes par type)
    structureTool({ structure }),
    // Console GROQ pour tester les requêtes
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    // Empêche de créer plusieurs "Réglages" (singleton)
    templates: (templates) => templates.filter((t) => t.schemaType !== "settings"),
  },

  document: {
    // Cache "Réglages" du bouton de création global
    newDocumentOptions: (prev) => prev.filter((item) => item.templateId !== "settings"),
  },
});
