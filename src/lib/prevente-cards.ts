/**
 * Pastille et mention des cartes produit pendant la prévente.
 *
 * Les cartes (ProductCard, ProductTile) la calculent elles-mêmes depuis la
 * langue de la page plutôt que de la recevoir de chaque appelant : tant que la
 * prévente est ouverte, « PRÉCOMMANDE » remplace toute autre pastille. Pas de
 * « Best seller » tant que rien n'est vendu (Sandro, 30 oct.).
 *
 * Module serveur (il lit Sanity) : prevente.ts, lui, reste importable côté
 * navigateur.
 */
import { getPrevente } from "./sanity";
import { locales, useTranslations, type Locale } from "../i18n";

export type PreventeCard = { badge: string; launchLabel: string | null };

export async function preventeCard(lang: string | undefined, hasCompare: boolean): Promise<PreventeCard | null> {
  if (!lang || !(locales as readonly string[]).includes(lang)) return null;
  const prevente = await getPrevente();
  if (!prevente.active) return null;
  const t = useTranslations(lang as Locale);
  return { badge: t("prevente.cardBadge"), launchLabel: hasCompare ? t("prevente.launchPrice") : null };
}
