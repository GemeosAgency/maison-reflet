import { defineCliConfig } from "sanity/cli";

/**
 * Config CLI du Studio (commandes `sanity dev`, `sanity build`, `sanity deploy`).
 * Le projectId/dataset sont lus depuis studio/.env (SANITY_STUDIO_PROJECT_ID,
 * SANITY_STUDIO_DATASET) avec un repli sur les valeurs du projet.
 */
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || "uacey1u9",
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
  },
  // URL du Studio hébergé : https://maison-reflet.sanity.studio
  studioHost: "maison-reflet",
  deployment: {
    appId: "eag3u9i72k7dbzf5uea4g8j8",
  },
});
