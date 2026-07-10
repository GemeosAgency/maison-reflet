import type { StructureResolver } from "sanity/structure";

/**
 * Organisation du Studio. "Réglages" est un singleton (un seul document,
 * pas de liste). Le reste est listé par type.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Contenu")
    .items([
      S.listItem()
        .title("Réglages")
        .id("settings")
        .child(S.document().schemaType("settings").documentId("settings")),
      S.divider(),
      S.documentTypeListItem("parfum").title("Parfums"),
      S.documentTypeListItem("coffret").title("Coffrets"),
      S.documentTypeListItem("note").title("Notes olfactives"),
      S.documentTypeListItem("ingredient").title("Ingrédients"),
      S.documentTypeListItem("reassurance").title("Réassurance"),
      S.documentTypeListItem("page").title("Pages"),
      S.divider(),
      S.documentTypeListItem("subscriber").title("Inscrits (liste d'attente)"),
    ]);
