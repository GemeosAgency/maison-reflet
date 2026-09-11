import { defineType, defineField } from "sanity";

/**
 * Contenu éditorial d'un parfum, relié au produit Shopify via shopifyHandle.
 * Champs texte traduisibles (fr/ar/en) ; notes olfactives = références vers
 * la bibliothèque de matières (type "note").
 */
export default defineType({
  name: "parfum",
  title: "Parfum",
  type: "document",
  groups: [
    { name: "contenu", title: "Contenu", default: true },
    { name: "notes", title: "Notes olfactives" },
    { name: "medias", title: "Médias" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "shopifyHandle",
      title: "Handle Shopify",
      type: "string",
      description:
        "Doit correspondre EXACTEMENT au handle du produit dans Shopify. C'est le lien entre les deux systèmes.",
      validation: (Rule) => Rule.required(),
      group: "contenu",
    }),
    defineField({
      name: "nomAffiche",
      title: "Nom (repère Studio)",
      type: "string",
      description: "Sert seulement à identifier la fiche dans le Studio.",
      group: "contenu",
    }),
    defineField({ name: "accroche", title: "Accroche", type: "localeString", group: "contenu" }),
    defineField({
      name: "description",
      title: "Description du produit",
      description: "Texte riche affiché dans l'accordéon « Description du produit » (paragraphes, listes à puces…).",
      type: "localeBlock",
      group: "contenu",
    }),
    defineField({
      name: "inspiredBy",
      title: "Inspiré de",
      type: "string",
      description: "Parfum de référence (ex : Baccarat Rouge 540). Affiché « INSPIRÉ DE … ».",
      group: "contenu",
    }),
    defineField({
      name: "specificTwist",
      title: "Le twist spécifique de ce reflet",
      description:
        "Un ou deux paragraphes qui expliquent en quoi CE reflet réinterprète le parfum de référence (ex : « Bois Impérial a fait du bois de santal sa signature… »). Affiché dans la modale « The Specific Twist », au-dessus du texte de présentation de la maison (fixe, non modifiable ici). Un paragraphe par ligne.",
      type: "localeText",
      group: "contenu",
    }),
    defineField({
      name: "perfumerWord",
      title: "Mot du parfumeur — citation",
      description: "Courte citation affichée dans la modale « Perfumer's word », à côté de sa photo.",
      type: "localeText",
      group: "contenu",
    }),
    defineField({
      name: "blocs",
      title: "Blocs éditoriaux",
      description:
        "Sections storytelling de la page produit (titre + texte + image), affichées en alterné.",
      type: "array",
      group: "contenu",
      of: [
        {
          type: "object",
          name: "blocEditorial",
          fields: [
            defineField({ name: "titre", title: "Titre", type: "localeString" }),
            defineField({ name: "texte", title: "Texte", type: "localeText" }),
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              description: "Si vide, une image de la galerie est utilisée.",
            }),
            defineField({
              name: "imageAGauche",
              title: "Image à gauche",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: { select: { title: "titre.fr", media: "image" } },
        },
      ],
    }),
    defineField({
      name: "reassurancesCta",
      title: "Réassurance — sous le bouton d'achat",
      description:
        "Liste compacte (icône + texte court) affichée juste sous le bouton « Add to bag ». Choisis lesquels afficher et dans quel ordre.",
      type: "array",
      group: "contenu",
      of: [{ type: "reference", to: [{ type: "reassurance" }] }],
    }),
    defineField({
      name: "reassurances",
      title: "Réassurance — bandeau pleine largeur",
      description:
        "Bandeau illustré affiché plus bas sur la page (livraison, paiement, échantillons…). Choisis lesquels afficher et dans quel ordre.",
      type: "array",
      group: "contenu",
      of: [{ type: "reference", to: [{ type: "reassurance" }] }],
    }),
    defineField({
      name: "faqs",
      title: "FAQ",
      description: "Questions fréquentes affichées sur cette fiche. Choisis lesquelles et dans quel ordre.",
      type: "array",
      group: "contenu",
      of: [{ type: "reference", to: [{ type: "faq" }] }],
    }),
    defineField({
      name: "familleOlfactive",
      title: "Famille olfactive (ancien champ)",
      type: "string",
      options: {
        list: ["Florale", "Boisée", "Orientale", "Ambrée", "Épicée", "Hespéridée", "Chyprée", "Fougère"],
      },
      description: "Déprécié — remplacé par « Familles olfactives » ci-dessous (texte libre, traduisible).",
      hidden: ({ document }) => Boolean(document?.familles),
      group: "contenu",
    }),
    defineField({
      name: "familles",
      title: "Familles olfactives",
      type: "localeString",
      description:
        "Texte libre affiché dans la rangée « Olfactive family » (ex : « Boisée, Aérienne » / « Woody, Airy »). Remplace l'ancien menu déroulant.",
      group: "contenu",
    }),
    defineField({
      name: "intensite",
      title: "Intensité (1–5)",
      type: "number",
      description: "Jauge « Intensity » de la fiche produit. 1–2 = légère, 3 = modérée, 4–5 = haute.",
      validation: (Rule) => Rule.min(1).max(5).integer(),
      group: "contenu",
    }),
    defineField({
      name: "sillage",
      title: "Sillage (1–5)",
      type: "number",
      description: "Jauge « Sillage » de la fiche produit. 1–2 = léger, 3 = modéré, 4–5 = fort.",
      validation: (Rule) => Rule.min(1).max(5).integer(),
      group: "contenu",
    }),
    defineField({
      name: "bestSeller",
      title: "Best-seller",
      type: "boolean",
      initialValue: false,
      description: "Affiche le badge « Best seller » sur les cartes produit (« You may also like », catalogue…).",
      group: "contenu",
    }),
    defineField({
      name: "nouveau",
      title: "Nouveauté",
      type: "boolean",
      initialValue: false,
      description: "Affiche le badge « Nouveau » dans le menu de navigation. À décocher quelques semaines après le lancement.",
      group: "contenu",
    }),
    defineField({ name: "parfumeur", title: "Parfumeur", type: "string", group: "contenu" }),
    defineField({
      name: "couleurSignature",
      title: "Couleur signature",
      type: "string",
      description: "Code hex (ex : #7A1E2B) — accent visuel de la page produit.",
      group: "contenu",
    }),
    defineField({
      name: "notesTete",
      title: "Notes de tête",
      description: "La PREMIÈRE note de la liste est la note-clé : affichée en gras sur la fiche produit.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "note" }] }],
      group: "notes",
    }),
    defineField({
      name: "notesCoeur",
      title: "Notes de cœur",
      description: "La PREMIÈRE note de la liste est la note-clé : affichée en gras sur la fiche produit.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "note" }] }],
      group: "notes",
    }),
    defineField({
      name: "notesFond",
      title: "Notes de fond",
      description: "La PREMIÈRE note de la liste est la note-clé : affichée en gras sur la fiche produit.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "note" }] }],
      group: "notes",
    }),
    /*
     * Pas de champ image par niveau ici : le visuel des colonnes de la section
     * « Scent Notes » vient du champ Image de la MATIÈRE (type "note"), via la
     * note-clé de chaque niveau. Une matière est photographiée une fois et
     * réutilisée sur tous les parfums qui l'emploient.
     */
    defineField({
      name: "imageTwist",
      title: "Image — The Specific Twist",
      type: "image",
      options: { hotspot: true },
      description: "Grande image panoramique (bordée) affichée sous le texte « The Specific Twist ».",
      group: "medias",
    }),
    defineField({
      name: "ingredients",
      title: "Ingrédients",
      description: "Liste réglementaire affichée dans « Voir tous les ingrédients ».",
      type: "array",
      of: [{ type: "reference", to: [{ type: "ingredient" }] }],
      group: "notes",
    }),
    defineField({
      name: "imageRecommandation",
      title: "Image — « Vous aimerez aussi »",
      type: "image",
      options: { hotspot: true },
      description:
        "Image dédiée (format portrait) utilisée dans la section « Vous aimerez aussi ». Si vide, l'image du produit Shopify est utilisée.",
      group: "medias",
    }),
    defineField({
      name: "imageRecommandationHover",
      title: "Image « Vous aimerez aussi » — au survol",
      type: "image",
      options: { hotspot: true },
      description:
        "Deuxième visuel affiché au survol de la carte (ex : packaging, coffret). Si vide, l'image reste inchangée au survol.",
      group: "medias",
    }),
    defineField({
      name: "imagePyramide",
      title: "Image — Pyramide olfactive",
      type: "image",
      options: { hotspot: true },
      description:
        "Illustration dessinée de la pyramide olfactive, affichée en haut de la modale « Olfactory Pyramid ». Si vide, seules les notes texte (tête/cœur/fond) sont affichées.",
      group: "medias",
    }),
    defineField({
      name: "perfumerPhoto",
      title: "Photo du parfumeur",
      type: "image",
      options: { hotspot: true },
      description: "Affichée dans la modale « Perfumer's word », au-dessus de la citation.",
      group: "medias",
    }),
    defineField({
      name: "imagesEditoriales",
      title: "Galerie du parfum",
      description:
        "Images de la galerie de la page produit (empilées, dans l'ordre). Si vide, on retombe sur les images du produit Shopify.",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Texte alternatif", type: "localeString" }),
            defineField({ name: "caption", title: "Légende", type: "localeString" }),
          ],
        },
      ],
      group: "medias",
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  preview: {
    select: { title: "nomAffiche", subtitle: "shopifyHandle", media: "imagesEditoriales.0" },
  },
});
