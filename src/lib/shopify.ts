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
  variables: Record<string, unknown> = {}
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
      availableForSale: boolean;
      price: ShopifyMoney;
      selectedOptions: { name: string; value: string }[];
    }[];
  };
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
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
        availableForSale
        price {
          amount
          currencyCode
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

/** Crée un panier Shopify (Cart API) avec une première ligne */
export async function createCart(merchandiseId: string, quantity = 1) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
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
  }>(query, { lines: [{ merchandiseId, quantity }] });

  assertNoUserErrors(data.cartCreate.userErrors);
  assertNoStockWarnings(data.cartCreate.warnings);
  return data.cartCreate.cart;
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

/** Ajoute une ligne à un panier existant (fusionne les quantités si la variante y est déjà) */
export async function addCartLine(cartId: string, merchandiseId: string, quantity = 1) {
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
  }>(query, { cartId, lines: [{ merchandiseId, quantity }] });

  assertNoUserErrors(data.cartLinesAdd.userErrors);
  assertNoStockWarnings(data.cartLinesAdd.warnings);
  return data.cartLinesAdd.cart;
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
