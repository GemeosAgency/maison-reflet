import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";

/**
 * À compléter une fois le projet Sanity créé sur sanity.io/manage :
 * - projectId : visible dans les settings du projet
 * - dataset   : "production" par défaut
 */
export default defineConfig({
  name: "maison-reflet",
  title: "Maison Reflet",

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "REMPLACER_PROJECT_ID",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",

  // visionTool : console GROQ dans le Studio, pratique pour tester les
  // requêtes de src/lib/sanity.ts avant de les modifier
  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
});
