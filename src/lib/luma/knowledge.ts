/**
 * Ce que Luma sait au moment de répondre — assemblé à chaque tour, jamais figé.
 *
 * Trois sources, chacune pour ce qu'elle sait vraiment :
 *
 * - **Shopify** décide de ce qui EXISTE, à quel prix, et si c'est disponible.
 *   C'est la seule vérité du catalogue : un produit ajouté apparaît, un produit
 *   retiré disparaît, une rupture se voit — sans redéploiement (exigence de
 *   Sandro, 10 septembre 2026). Les prix arrivent dans la devise que Shopify
 *   pratique RÉELLEMENT pour le pays du visiteur — aujourd'hui l'AED partout,
 *   tant que les listes de prix par marché n'existent pas (voir
 *   docs/grille-tarifaire.md) — jamais dans celle qu'on aimerait afficher.
 * - **Sanity** fournit notes, référence et description : uniquement la liste
 *   blanche de `getLumaParfums` (sanity.ts), le reste racontant encore
 *   l'ancienne collection.
 * - **collection.ts** porte la lecture éditoriale de Sandro (twist, essence)
 *   tant que Sanity n'est pas nettoyé (section 12 du persona).
 *
 * Ce module est PUR : ni réseau ni environnement. L'accès aux sources vit dans
 * knowledge-live.ts. C'est ce qui permet de le tester avec des fixtures dans
 * Node, alors que shopify.ts lit import.meta.env au chargement.
 */

import type { ShopifyProduct } from "../shopify";
import type { LumaParfumDoc } from "../sanity";
import type { Locale } from "../../i18n";
import { isCoffret, isSampleVariantTitle } from "../product-kind";
import {
  DELIVERY_DAYS,
  UAE_DELIVERY_DAYS,
  freeShippingThreshold,
  sameDayStatus,
  shippingRate,
  type Country,
} from "../markets";
import {
  COFFRETS,
  CONTACT_EMAIL,
  DIAGNOSTIC_QUESTIONS,
  MATCH_RULES,
  REASSURANCES,
  REFLETS,
  UNIVERSES,
  knownProduct,
} from "./collection";

export type KnowledgeVariant = {
  id: string;
  title: string;
  /** Échantillon 2 ml — l'alternative quand le visiteur ne veut en tester qu'un. */
  sample: boolean;
  price: number;
  currency: string;
  available: boolean;
};

export type KnowledgeProduct = {
  handle: string;
  /** Nom à prononcer : titre Shopify pour les parfums (identique dans les trois langues), nom localisé pour les coffrets. */
  name: string;
  kind: "parfum" | "coffret";
  /** Visuel Shopify du produit, pour la carte affichée par le widget. */
  image: string | null;
  /** Au moins une variante vendable. La disponibilité se dit, elle ne se compte pas. */
  available: boolean;
  variants: KnowledgeVariant[];
  /** « Twist de … » — la référence assumée, telle qu'écrite par Sandro. */
  twistOf: string | null;
  /** « Ce que Luma en retient ». */
  essence: string | null;
  inspiredBy: string | null;
  bestSeller: boolean;
  familles: string | null;
  /** Ce qu'on garde, ce qu'on ajoute — la réponse à « quelle différence avec l'original ? » (persona §8). */
  description: string | null;
  notes: { tete: string[]; coeur: string[]; fond: string[] } | null;
};

export type Logistics = {
  countryCode: string;
  zone: Country["zone"];
  /** Devise réellement pratiquée par Shopify pour ce pays — celle des prix ci-dessus. */
  currency: string;
  freeShippingThreshold: number;
  shippingRate: number;
  /** La promesse affichée par le site pour ce marché, en jours ouvrés. */
  deliveryDays: { min: number; max: number };
  /**
   * Émirats seulement : livraison le jour même à Dubaï si la commande part
   * maintenant. On n'expose pas l'heure limite : « avant 14h » serait pris pour
   * une tenue en heures par les garde-fous, et « commandé maintenant, livré
   * aujourd'hui » dit la même chose sans chiffre.
   */
  sameDayDubai: { open: boolean } | null;
};

export type Knowledge = {
  locale: Locale;
  country: Country;
  products: KnowledgeProduct[];
  logistics: Logistics;
  matchRules: typeof MATCH_RULES;
  diagnosticQuestions: typeof DIAGNOSTIC_QUESTIONS;
  universes: typeof UNIVERSES;
  reassurances: typeof REASSURANCES;
  contactEmail: string;
  /** Les seuls produits que Luma peut nommer : ceux que Shopify vend aujourd'hui. */
  allowedHandles: string[];
  /** Nombres que Luma a le droit d'écrire — le contrat de `checkNumbers`. */
  allowedNumbers: number[];
  /** Délais que Luma a le droit de promettre — ceux du site pour ce marché. */
  allowedDelays: number[];
};

export type KnowledgeInput = {
  products: ShopifyProduct[];
  parfums: LumaParfumDoc[];
  country: Country;
  locale: Locale;
  now?: Date;
};

export function buildKnowledge({ products, parfums, country, locale, now = new Date() }: KnowledgeInput): Knowledge {
  const docByHandle = new Map(parfums.map((doc) => [doc.shopifyHandle, doc]));

  // Shopify fait foi : une fiche Sanity ou collection.ts sans produit vendu
  // n'entre pas — c'est ainsi qu'un produit retiré disparaît de sa mémoire.
  const items = products
    .map((product) => toKnowledgeProduct(product, docByHandle.get(product.handle), locale))
    .sort(compareProducts);

  // La devise des prix, pas celle du marché espéré : tant que Shopify répond
  // en AED à un visiteur français, seuil et frais doivent être en AED aussi.
  const currency = items.find((p) => p.variants.length > 0)?.variants[0].currency ?? country.currency;
  const isUae = country.code === "AE";
  const deliveryDays = isUae ? UAE_DELIVERY_DAYS : DELIVERY_DAYS[country.group];

  const logistics: Logistics = {
    countryCode: country.code,
    zone: country.zone,
    currency,
    freeShippingThreshold: freeShippingThreshold(currency),
    shippingRate: shippingRate(country.zone, currency),
    deliveryDays,
    sameDayDubai: isUae ? { open: sameDayStatus(now).open } : null,
  };

  return {
    locale,
    country,
    products: items,
    logistics,
    matchRules: MATCH_RULES,
    diagnosticQuestions: DIAGNOSTIC_QUESTIONS,
    universes: UNIVERSES,
    reassurances: REASSURANCES,
    contactEmail: CONTACT_EMAIL,
    allowedHandles: items.map((p) => p.handle),
    allowedNumbers: allowedNumbers(items, logistics),
    allowedDelays: [deliveryDays.min, deliveryDays.max],
  };
}

export function findProduct(knowledge: Knowledge, handle: string): KnowledgeProduct | undefined {
  return knowledge.products.find((p) => p.handle === handle);
}

/* ------------------------------------------------------------------ */

function toKnowledgeProduct(
  product: ShopifyProduct,
  doc: LumaParfumDoc | undefined,
  locale: Locale
): KnowledgeProduct {
  const known = knownProduct(product.handle);
  const kind: KnowledgeProduct["kind"] = isCoffret(product) ? "coffret" : "parfum";

  const variants: KnowledgeVariant[] = product.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    sample: isSampleVariantTitle(v.title),
    price: Number(v.price.amount),
    currency: v.price.currencyCode,
    available: v.availableForSale,
  }));

  const hasNotes = Boolean(doc && (doc.notes.tete.length || doc.notes.coeur.length || doc.notes.fond.length));

  return {
    handle: product.handle,
    name: displayName(product, known, kind, locale),
    kind,
    image: product.featuredImage?.url ?? null,
    available: variants.some((v) => v.available),
    variants,
    twistOf: known && "twistOf" in known ? known.twistOf : null,
    essence: known?.essence ?? null,
    inspiredBy: doc?.inspiredBy ?? null,
    bestSeller: doc?.bestSeller ?? (known && "bestSeller" in known ? Boolean(known.bestSeller) : false),
    familles: doc?.familles?.trim() ? doc.familles : null,
    description: doc?.description?.trim() ? doc.description : null,
    notes: hasNotes && doc ? doc.notes : null,
  };
}

function displayName(
  product: ShopifyProduct,
  known: ReturnType<typeof knownProduct>,
  kind: KnowledgeProduct["kind"],
  locale: Locale
): string {
  // Les coffrets ont un nom par langue (persona §4) ; les parfums gardent leur
  // nom tel quel dans les trois.
  if (kind === "coffret" && known && "nameEn" in known) {
    return locale === "en" ? known.nameEn : locale === "ar" ? known.nameAr : known.name;
  }
  return product.title?.trim() || known?.name || product.handle;
}

const REFLET_ORDER = new Map(REFLETS.map((r, i) => [r.handle, i]));
const COFFRET_ORDER = new Map(COFFRETS.map((c, i) => [c.handle, i]));

/** Parfums avant coffrets ; best-seller en tête ; puis l'ordre du persona, les nouveautés à la fin. */
function compareProducts(a: KnowledgeProduct, b: KnowledgeProduct): number {
  if (a.kind !== b.kind) return a.kind === "parfum" ? -1 : 1;
  if (a.kind === "parfum" && a.bestSeller !== b.bestSeller) return a.bestSeller ? -1 : 1;
  const order = a.kind === "parfum" ? REFLET_ORDER : COFFRET_ORDER;
  const ai = order.get(a.handle) ?? Number.MAX_SAFE_INTEGER;
  const bi = order.get(b.handle) ?? Number.MAX_SAFE_INTEGER;
  return ai - bi || a.name.localeCompare(b.name);
}

/**
 * Le contrat de `checkNumbers` : tout nombre ≥ 100 écrit par Luma doit être
 * ici. Les prix, le seuil de livraison offerte, les frais de port — et les
 * nombres qui vivent dans les textes qu'elle a le droit de citer (« Baccarat
 * Rouge 540 » est un nom, pas un chiffre inventé). Les prix étant ronds par
 * politique de marque, on ne gère pas les centimes.
 */
function allowedNumbers(items: KnowledgeProduct[], logistics: Logistics): number[] {
  const numbers = new Set<number>();
  for (const p of items) {
    for (const v of p.variants) numbers.add(v.price);
    for (const text of [p.twistOf, p.essence, p.inspiredBy, p.description, p.familles]) {
      for (const n of text?.match(/\d+/g) ?? []) numbers.add(Number(n));
    }
  }
  numbers.add(logistics.freeShippingThreshold);
  numbers.add(logistics.shippingRate);
  return [...numbers].sort((a, b) => a - b);
}
