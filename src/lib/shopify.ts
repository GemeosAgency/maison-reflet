/**
 * Client Shopify Storefront API
 * Documentation : https://shopify.dev/docs/api/storefront
 *
 * Variables d'env requises (voir .env.example) :
 * - PUBLIC_SHOPIFY_STORE_DOMAIN      ex: maison-reflet.myshopify.com
 * - PUBLIC_SHOPIFY_STOREFRONT_TOKEN  token public Storefront API (pas le token Admin)
 * - PUBLIC_SHOPIFY_API_VERSION       ex: 2025-10 (garder à jour tous les 3 mois)
 *
 * Préfixe PUBLIC_ : le token Storefront est public par conception chez Shopify
 * (lecture catalogue + panier uniquement, rate-limité par IP). Le préfixe permet
 * d'appeler la Cart API directement depuis le navigateur (flux panier), sans
 * passer par une fonction serveur. Ne JAMAIS mettre le token Admin ici.
 */

const domain = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN;
const token = import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
const apiVersion = import.meta.env.PUBLIC_SHOPIFY_API_VERSION || "2025-10";

const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

type ShopifyResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  // keepalive : la requête survit à une navigation (utile pour les mutations
  // fire-and-forget juste avant le départ vers le checkout, voir cart.ts).
  init: { keepalive?: boolean } = {}
): Promise<T> {
  if (!domain || !token) {
    throw new Error(
      "[shopify] PUBLIC_SHOPIFY_STORE_DOMAIN ou PUBLIC_SHOPIFY_STOREFRONT_TOKEN manquant. " +
        "Vérifie ton .env — voir .env.example."
    );
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...(init.keepalive && { keepalive: true }),
  });

  if (!res.ok) {
    throw new Error(`Shopify Storefront API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as ShopifyResponse<T>;

  if (json.errors?.length) {
    throw new Error(
      `Shopify Storefront API GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }

  if (!json.data) {
    throw new Error("Shopify Storefront API: réponse vide (pas de data)");
  }

  return json.data;
}

// ---------- Types ----------

export type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

/** Formate un montant Shopify ("39.0" + "EUR") pour l'affichage — utilisable au build comme dans le navigateur */
export function formatPrice(amount: string, currencyCode: string): string {
  return Number(amount).toLocaleString("fr-FR", {
    style: "currency",
    currency: currencyCode,
  });
}

export type ShopifyImage = {
  url: string;
  altText: string | null;
  width: number;
  height: number;
};

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  category: { id: string; name: string } | null;
  featuredImage: ShopifyImage | null;
  images: { nodes: ShopifyImage[] };
  priceRange: {
    minVariantPrice: ShopifyMoney;
    maxVariantPrice: ShopifyMoney;
  };
  variants: {
    nodes: {
      id: string;
      title: string;
      sku: string | null;
      availableForSale: boolean;
      price: ShopifyMoney;
      image: ShopifyImage | null;
      selectedOptions: { name: string; value: string }[];
    }[];
  };
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  cost: {
    totalAmount: ShopifyMoney;
    subtotalAmount: ShopifyMoney;
  };
  merchandise: {
    id: string;
    title: string;
    price: ShopifyMoney;
    product: {
      title: string;
      handle: string;
      featuredImage: ShopifyImage | null;
    };
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: ShopifyMoney;
  };
  lines: { nodes: ShopifyCartLine[] };
};

// ---------- Queries ----------

const PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment ProductFragment on Product {
    id
    handle
    title
    description
    descriptionHtml
    productType
    category {
      id
      name
    }
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 10) {
      nodes {
        url
        altText
        width
        height
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 20) {
      nodes {
        id
        title
        sku
        availableForSale
        price {
          amount
          currencyCode
        }
        image {
          url
          altText
          width
          height
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
`;

/** Récupère tous les produits de la collection "Les 6 Reflets" (ou toute la boutique si pas de collection dédiée) */
export async function getAllProducts(first = 20) {
  const query = /* GraphQL */ `
    ${PRODUCT_FRAGMENT}
    query AllProducts($first: Int!) {
      products(first: $first) {
        nodes {
          ...ProductFragment
        }
      }
    }
  `;

  const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>(query, { first });
  return data.products.nodes;
}

// Mots-clés de la catégorie Shopify (taxonomie standard) qui signalent un coffret/set,
// par opposition à un parfum vendu à l'unité (ex : "Perfume Sample & Discovery Sets").
const COFFRET_CATEGORY_KEYWORDS = ["sample", "discovery", "gift set", "coffret", "set"];

/**
 * Un coffret (set multi-parfums) n'est pas un parfum classique : distingué soit par le
 * champ "Type de produit" ("Coffret"), soit par la Category Shopify standard (ex :
 * "Perfume Sample & Discovery Sets") — les deux fonctionnent, selon celui rempli côté fiche produit.
 */
export function isCoffret(product: Pick<ShopifyProduct, "productType" | "category">) {
  if (product.productType?.trim().toLowerCase() === "coffret") return true;
  const categoryName = product.category?.name?.toLowerCase() ?? "";
  return COFFRET_CATEGORY_KEYWORDS.some((k) => categoryName.includes(k));
}

// Mots-clés identifiant une variante "échantillon offert" (offerte dans le panier,
// prix 0). Ces variantes ne doivent JAMAIS servir de prix/variante d'affichage :
// sinon le "à partir de" (priceRange.minVariantPrice) et les cartes produit
// tombent à 0,00. Doit rester cohérent avec la détection du panier (CartDrawer).
const SAMPLE_VARIANT_KEYWORDS = ["sample", "échantillon", "echantillon", "2 ml", "2ml"];

/** Vrai si le titre de variante correspond à un échantillon (ex : "2 ml", "Échantillon") */
export function isSampleVariantTitle(title: string): boolean {
  const l = title.toLowerCase();
  return SAMPLE_VARIANT_KEYWORDS.some((k) => l.includes(k));
}

type ProductVariant = ShopifyProduct["variants"]["nodes"][number];

/**
 * Variante "principale" d'un produit pour l'affichage/l'ajout au panier : la
 * première variante vendable qui n'est PAS un échantillon (repli : première non
 * échantillon, puis première tout court). Évite de sélectionner l'échantillon à
 * 0 AED comme variante par défaut.
 */
export function getPrimaryVariant(product: Pick<ShopifyProduct, "variants">): ProductVariant {
  const variants = product.variants.nodes;
  const nonSample = variants.filter((v) => !isSampleVariantTitle(v.title));
  return (
    nonSample.find((v) => v.availableForSale) ??
    nonSample[0] ??
    variants.find((v) => v.availableForSale) ??
    variants[0]
  );
}

/** Prix d'affichage d'un produit (celui de sa variante principale, hors échantillon) */
export function getDisplayPrice(product: Pick<ShopifyProduct, "variants">): ShopifyMoney {
  return getPrimaryVariant(product).price;
}

/** Récupère un produit par son handle (slug Shopify) */
export async function getProductByHandle(handle: string) {
  const query = /* GraphQL */ `
    ${PRODUCT_FRAGMENT}
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        ...ProductFragment
      }
    }
  `;

  const data = await shopifyFetch<{ product: ShopifyProduct | null }>(query, { handle });
  return data.product;
}

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFragment on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 50) {
      nodes {
        id
        quantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              amount
              currencyCode
            }
            product {
              title
              handle
              featuredImage {
                url
                altText
                width
                height
              }
            }
          }
        }
      }
    }
  }
`;

type CartUserError = { field: string[] | null; message: string };

// Depuis l'API 2025-10, les mutations cart signalent les problèmes de stock
// via `warnings` (et non userErrors) : sans ce contrôle, ajouter une variante
// devenue épuisée « réussit » sans rien ajouter au panier.
type CartWarning = { code: string; message: string; target: string | null };

function assertNoUserErrors(errors: CartUserError[]) {
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
}

function assertNoStockWarnings(warnings: CartWarning[] | undefined) {
  const blocking = (warnings ?? []).filter(
    (w) => w.code === "MERCHANDISE_OUT_OF_STOCK" || w.code === "MERCHANDISE_NOT_ENOUGH_STOCK"
  );
  if (blocking.length) {
    throw new Error(blocking.map((w) => w.message).join(", "));
  }
}

export type CartLineInput = { merchandiseId: string; quantity: number };
export type CartAttributeInput = { key: string; value: string };

/**
 * Crée un panier Shopify (Cart API) avec une ou plusieurs lignes (ex : lot
 * Buy 2 Get 1 Free). Les `attributes` optionnels suivent le panier jusqu'à la
 * commande (note_attributes du webhook) — utilisés pour transporter les ids
 * publicitaires _fbp/_fbc à travers le saut de domaine du checkout (voir
 * cart.ts et api/webhooks/shopify-orders.ts). Préfixe "_" = masqué au client
 * dans le récapitulatif de commande.
 */
export async function createCart(lines: CartLineInput[], attributes: CartAttributeInput[] = []) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartCreate($lines: [CartLineInput!]!, $attributes: [AttributeInput!]) {
      cartCreate(input: { lines: $lines, attributes: $attributes }) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
        warnings {
          code
          message
          target
        }
      }
    }
  `;

  const data = await shopifyFetch<{
    cartCreate: {
      cart: ShopifyCart | null;
      userErrors: CartUserError[];
      warnings?: CartWarning[];
    };
  }>(query, { lines, attributes });

  assertNoUserErrors(data.cartCreate.userErrors);
  assertNoStockWarnings(data.cartCreate.warnings);
  return data.cartCreate.cart;
}

/**
 * Met à jour les attributs d'un panier existant. `keepalive` permet un envoi
 * fire-and-forget qui survit à la navigation (rafraîchissement des ids
 * publicitaires au clic checkout — cas du visiteur revenu via une pub après
 * la création du panier).
 */
export async function updateCartAttributes(
  cartId: string,
  attributes: CartAttributeInput[],
  init: { keepalive?: boolean } = {}
) {
  const query = /* GraphQL */ `
    mutation CartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
      cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
        cart {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{
    cartAttributesUpdate: { cart: { id: string } | null; userErrors: CartUserError[] };
  }>(query, { cartId, attributes }, init);

  assertNoUserErrors(data.cartAttributesUpdate.userErrors);
  return data.cartAttributesUpdate.cart;
}

/** Récupère un panier existant par son id — null si expiré ou introuvable */
export async function getCart(cartId: string) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ...CartFragment
      }
    }
  `;

  const data = await shopifyFetch<{ cart: ShopifyCart | null }>(query, { cartId });
  return data.cart;
}

/** Ajoute une ou plusieurs lignes à un panier existant (fusionne les quantités si déjà présentes) */
export async function addCartLine(cartId: string, lines: CartLineInput[]) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
        warnings {
          code
          message
          target
        }
      }
    }
  `;

  const data = await shopifyFetch<{
    cartLinesAdd: {
      cart: ShopifyCart | null;
      userErrors: CartUserError[];
      warnings?: CartWarning[];
    };
  }>(query, { cartId, lines });

  assertNoUserErrors(data.cartLinesAdd.userErrors);
  assertNoStockWarnings(data.cartLinesAdd.warnings);
  return data.cartLinesAdd.cart;
}

export type CartLineUpdateInput = { id: string; quantity: number };

/** Modifie la quantité d'une ou plusieurs lignes d'un panier existant */
export async function updateCartLines(cartId: string, lines: CartLineUpdateInput[]) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
        warnings {
          code
          message
          target
        }
      }
    }
  `;

  const data = await shopifyFetch<{
    cartLinesUpdate: {
      cart: ShopifyCart | null;
      userErrors: CartUserError[];
      warnings?: CartWarning[];
    };
  }>(query, { cartId, lines });

  assertNoUserErrors(data.cartLinesUpdate.userErrors);
  assertNoStockWarnings(data.cartLinesUpdate.warnings);
  return data.cartLinesUpdate.cart;
}

/** Retire une ligne d'un panier existant */
export async function removeCartLine(cartId: string, lineId: string) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyFetch<{
    cartLinesRemove: { cart: ShopifyCart | null; userErrors: CartUserError[] };
  }>(query, { cartId, lineIds: [lineId] });

  assertNoUserErrors(data.cartLinesRemove.userErrors);
  return data.cartLinesRemove.cart;
}
