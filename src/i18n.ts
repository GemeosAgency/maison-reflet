/** Configuration i18n du site : langues, libellés d'interface, helpers. */

export const locales = ["fr", "ar", "en"] as const;
export type Locale = (typeof locales)[number];
// Langue de base du contenu (source des traductions, slugs, fallback de texte).
export const defaultLocale: Locale = "fr";
// Langue servie à un visiteur dont le navigateur n'est pas dans fr/ar/en.
export const fallbackLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

/** Préfixe une route interne avec la langue : localePath("ar", "/parfums") => "/ar/parfums" */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Libellés d'interface (le contenu éditorial vient de Sanity, lui). */
const ui = {
  fr: {
    "nav.parfums": "Les 6 Reflets",
    "nav.perfumes": "Parfums",
    "nav.services": "Services",
    "nav.faq": "FAQ",
    "nav.maison": "La Maison",
    "nav.panier": "Panier",
    "product.inspiredBy": "INSPIRÉ DE",
    "product.description": "Description du produit",
    "product.pyramid": "Pyramide olfactive",
    "product.ingredients": "Voir tous les ingrédients",
    "product.reviews": "avis",
    "product.related": "Vous aimerez aussi",
    "product.boxes": "Nos coffrets",
    "home.discover": "Découvrir la collection",
    "home.featured": "Les reflets phares",
    "product.story": "L'histoire",
    "product.notes": "Notes olfactives",
    "product.notes.tete": "Tête",
    "product.notes.coeur": "Cœur",
    "product.notes.fond": "Fond",
    "product.inspiration": "Inspiration culturelle",
    "product.addToCart": "Ajouter au panier",
    "product.soldOut": "Épuisé",
    "product.seeCart": "Voir le panier",
    "product.added": "Ajouté au panier ✓",
    "product.quantity": "Quantité",
    "product.size": "Contenance",
    "product.adding": "Ajout en cours…",
    "product.error": "Impossible d'ajouter au panier. Réessaie.",
    "cart.title": "Votre panier",
    "cart.empty": "Votre panier est vide.",
    "cart.subtotal": "Sous-total",
    "cart.checkout": "Passer au paiement",
    "cart.remove": "Retirer",
    "cart.loading": "Chargement du panier…",
    "cart.error": "Impossible de charger le panier. Recharge la page.",
  },
  ar: {
    "nav.parfums": "الانعكاسات الستة",
    "nav.perfumes": "عطور",
    "nav.services": "خدمات",
    "nav.faq": "الأسئلة الشائعة",
    "nav.maison": "الدار",
    "nav.panier": "السلة",
    "product.inspiredBy": "مستوحى من",
    "product.description": "وصف المنتج",
    "product.pyramid": "الهرم العطري",
    "product.ingredients": "عرض كل المكوّنات",
    "product.reviews": "تقييم",
    "product.related": "قد يعجبك أيضًا",
    "product.boxes": "علبنا",
    "home.discover": "اكتشف المجموعة",
    "home.featured": "عطور مختارة",
    "product.story": "الحكاية",
    "product.notes": "المكوّنات العطرية",
    "product.notes.tete": "المقدمة",
    "product.notes.coeur": "القلب",
    "product.notes.fond": "القاعدة",
    "product.inspiration": "الإلهام الثقافي",
    "product.addToCart": "أضف إلى السلة",
    "product.soldOut": "نفد",
    "product.seeCart": "عرض السلة",
    "product.added": "أُضيف إلى السلة ✓",
    "product.quantity": "الكمية",
    "product.size": "الحجم",
    "product.adding": "جارٍ الإضافة…",
    "product.error": "تعذّرت الإضافة إلى السلة. حاول مجددًا.",
    "cart.title": "سلتك",
    "cart.empty": "سلتك فارغة.",
    "cart.subtotal": "المجموع الفرعي",
    "cart.checkout": "إتمام الشراء",
    "cart.remove": "إزالة",
    "cart.loading": "جارٍ تحميل السلة…",
    "cart.error": "تعذّر تحميل السلة. أعد تحميل الصفحة.",
  },
  en: {
    "nav.parfums": "The 6 Reflections",
    "nav.perfumes": "Perfumes",
    "nav.services": "Services",
    "nav.faq": "FAQ",
    "nav.maison": "The House",
    "nav.panier": "Cart",
    "product.inspiredBy": "INSPIRED BY",
    "product.description": "Product description",
    "product.pyramid": "Olfactory pyramid",
    "product.ingredients": "See all ingredients",
    "product.reviews": "reviews",
    "product.related": "You may also like",
    "product.boxes": "Our boxes",
    "home.discover": "Discover the collection",
    "home.featured": "Featured reflections",
    "product.story": "The story",
    "product.notes": "Olfactory notes",
    "product.notes.tete": "Top",
    "product.notes.coeur": "Heart",
    "product.notes.fond": "Base",
    "product.inspiration": "Cultural inspiration",
    "product.addToCart": "Add to cart",
    "product.soldOut": "Sold out",
    "product.seeCart": "View cart",
    "product.added": "Added to cart ✓",
    "product.quantity": "Quantity",
    "product.size": "Size",
    "product.adding": "Adding…",
    "product.error": "Couldn't add to cart. Please try again.",
    "cart.title": "Your cart",
    "cart.empty": "Your cart is empty.",
    "cart.subtotal": "Subtotal",
    "cart.checkout": "Proceed to checkout",
    "cart.remove": "Remove",
    "cart.loading": "Loading cart…",
    "cart.error": "Couldn't load the cart. Please reload.",
  },
} as const;

type UIKey = keyof (typeof ui)["fr"];

export function useTranslations(locale: Locale) {
  return (key: UIKey): string => ui[locale][key] ?? ui.fr[key] ?? key;
}

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/**
 * Choisit la langue à servir sur la racine : d'abord un choix manuel mémorisé
 * (cookie), sinon la préférence du navigateur (Accept-Language), sinon FR.
 */
export function detectLocale(acceptLanguage: string | null, cookieLang?: string | null): Locale {
  if (isLocale(cookieLang)) return cookieLang;
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(",")
      .map((part) => {
        const [tag, q] = part.trim().split(";q=");
        return { base: tag.toLowerCase().split("-")[0], q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { base } of ranked) {
      if (isLocale(base)) return base;
    }
  }
  // Navigateur ni fr, ni ar, ni en → anglais (repli international).
  return fallbackLocale;
}
