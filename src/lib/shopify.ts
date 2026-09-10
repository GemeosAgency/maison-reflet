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

import { isCoffret, isSampleVariantTitle } from "./product-kind";

const domain = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN;
const token = import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
const apiVersion = import.meta.env.PUBLIC_SHOPIFY_API_VERSION || "2025-10";

const endpoint = `https://${domain}/api/${apiVersion}/graphql.json`;

type ShopifyResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/**
 * Contexte de marché d'une requête : pays (→ devise et disponibilité) et
 * langue (→ titres et descriptions traduits, une fois les locales publiées
 * côté Shopify). Les deux champs sont facultatifs ; sans eux, Shopify répond
 * dans le marché primaire, c'est-à-dire en AED et en anglais.
 */
export type ShopifyContext = {
  /** ISO 3166-1 alpha-2 en MAJUSCULES : "FR", "AE". */
  country?: string | null;
  /** ISO 639-1 en MAJUSCULES : "FR", "AR", "EN". */
  language?: string | null;
};

/**
 * Contexte appliqué quand l'appelant n'en passe pas.
 *
 * ⚠️ NAVIGATEUR UNIQUEMENT. Le sélecteur de pays le pose une fois au
 * chargement, ce qui évite de faire passer le pays à travers les quinze appels
 * de `cart.ts`. À NE JAMAIS appeler pendant le build : Astro rend les pages en
 * parallèle et un état de module fuirait d'une langue à l'autre — au build, le
 * contexte se passe explicitement en argument.
 */
let defaultContext: ShopifyContext | undefined;

export function setDefaultShopifyContext(context: ShopifyContext | undefined) {
  defaultContext = context;
}

function resolveContext(context?: ShopifyContext): ShopifyContext | undefined {
  return context ?? defaultContext;
}

/**
 * Injecte `@inContext` dans l'opération.
 *
 * La directive se pose sur l'opération, pas sur la requête HTTP : impossible
 * de la passer en en-tête, il faut réécrire la signature. On cible le premier
 * `query`/`mutation` nommé — les fragments qui précèdent (PRODUCT_FRAGMENT,
 * CART_FRAGMENT) ne contiennent aucun de ces deux mots-clés, la première
 * correspondance est donc bien l'opération elle-même.
 *
 * `$country` et `$language` sont déclarés nullables : passer `null` équivaut à
 * ne pas contextualiser, ce qui permet d'appeler toujours la même requête.
 */
function withContext(query: string, context?: ShopifyContext): string {
  if (!context || (!context.country && !context.language)) return query;

  const CONTEXT_VARS = "$country: CountryCode, $language: LanguageCode";
  const DIRECTIVE = " @inContext(country: $country, language: $language)";

  return query.replace(
    /\b(query|mutation)\s+(\w+)\s*(\(([\s\S]*?)\))?/,
    (match, keyword: string, name: string, _parens: string | undefined, vars: string | undefined) => {
      if (match.includes("@inContext")) return match;
      const declared = vars?.trim() ? `${vars.trim()}, ${CONTEXT_VARS}` : CONTEXT_VARS;
      return `${keyword} ${name}(${declared})${DIRECTIVE}`;
    }
  );
}

export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  // keepalive : la requête survit à une navigation (utile pour les mutations
  // fire-and-forget juste avant le départ vers le checkout, voir cart.ts).
  init: { keepalive?: boolean; context?: ShopifyContext } = {}
): Promise<T> {
  const context = resolveContext(init.context);

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
    body: JSON.stringify({
      query: withContext(query, context),
      variables: context
        ? {
            ...variables,
            country: context.country ?? null,
            language: context.language ?? null,
          }
        : variables,
    }),
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

/**
 * Formate un montant Shopify ("39.0" + "EUR") — utilisable au build comme dans
 * le navigateur.
 *
 * La langue gouverne la mise en forme (séparateurs, position du symbole,
 * chiffres arabes) : sans elle, un prix en yens ou en dirhams s'affichait avec
 * les conventions françaises quelle que soit la langue de la page.
 */
export function formatPrice(amount: string, currencyCode: string, locale = "fr-FR"): string {
  const value = Number(amount);
  // Prix ronds : la marque affiche « 320 AED », pas « 320,00 AED ». Les
  // centimes n'apparaissent que s'il y en a — un reste de conversion, ou une
  // remise au prorata. Même règle que `formatMoney` dans markets.ts.
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return value.toLocaleString(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
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
  /** Pays du panier : c'est lui qui fixe la devise du panier et du checkout. */
  buyerIdentity: { countryCode: string | null };
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
export async function getAllProducts(first = 20, context?: ShopifyContext) {
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

  const data = await shopifyFetch<{ products: { nodes: ShopifyProduct[] } }>(
    query,
    { first },
    { context }
  );
  return data.products.nodes;
}

// Les prédicats de catalogue (coffret ? échantillon ?) vivent dans
// product-kind.ts, sans dépendance à l'environnement, pour que Luma puisse les
// tester hors Astro. Ré-exportés ici pour les appelants historiques.
export { isCoffret, isSampleVariantTitle };

/**
 * Deuxième visuel d'un produit — la photo montrée au survol des tuiles,
 * quand Sanity n'en a pas de dédiée (imageRecommandationHover).
 *
 * Deux filtres, appris à l'usage :
 *  - les visuels de variante ÉCHANTILLON sont écartés ; ce sont des vignettes
 *    de 192 px destinées au panier, pas des angles de flacon ;
 *  - les doublons d'URL aussi, `featuredImage` figurant presque toujours déjà
 *    dans `images.nodes` — sans ça la "deuxième" photo était la première.
 */
export function secondaryImage(
  product: Pick<ShopifyProduct, "featuredImage" | "images" | "variants">
): ShopifyImage | null {
  const sampleUrls = new Set(
    product.variants.nodes
      .filter((v) => isSampleVariantTitle(v.title))
      .map((v) => v.image?.url)
      .filter((u): u is string => Boolean(u))
  );
  const photos = [product.featuredImage, ...product.images.nodes]
    .filter((im): im is ShopifyImage => im !== null && !sampleUrls.has(im.url))
    .filter((im, i, arr) => arr.findIndex((x) => x.url === im.url) === i);
  return photos[1] ?? null;
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
export async function getProductByHandle(handle: string, context?: ShopifyContext) {
  const query = /* GraphQL */ `
    ${PRODUCT_FRAGMENT}
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        ...ProductFragment
      }
    }
  `;

  const data = await shopifyFetch<{ product: ShopifyProduct | null }>(
    query,
    { handle },
    { context }
  );
  return data.product;
}

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFragment on Cart {
    id
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
    }
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
 * Crée un panier Shopify (Cart API) avec une ou plusieurs lignes. Les
 * `attributes` optionnels suivent le panier jusqu'à la
 * commande (note_attributes du webhook) — utilisés pour transporter les ids
 * publicitaires _fbp/_fbc à travers le saut de domaine du checkout (voir
 * cart.ts et api/webhooks/shopify-orders.ts). Préfixe "_" = masqué au client
 * dans le récapitulatif de commande.
 */
export async function createCart(
  lines: CartLineInput[],
  attributes: CartAttributeInput[] = [],
  context?: ShopifyContext
) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartCreate(
      $lines: [CartLineInput!]!
      $attributes: [AttributeInput!]
      $buyerIdentity: CartBuyerIdentityInput
    ) {
      cartCreate(
        input: { lines: $lines, attributes: $attributes, buyerIdentity: $buyerIdentity }
      ) {
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
  }>(
    query,
    {
      lines,
      attributes,
      // Fixe le pays du panier dès sa création : c'est lui qui détermine la
      // devise du panier ET du checkout. `@inContext` seul ne suffit pas —
      // Shopify mémorise le pays sur le panier, pas sur la requête.
      buyerIdentity: resolveContext(context)?.country
        ? { countryCode: resolveContext(context)!.country }
        : null,
    },
    { context }
  );

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
export async function getCart(cartId: string, context?: ShopifyContext) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ...CartFragment
      }
    }
  `;

  const data = await shopifyFetch<{ cart: ShopifyCart | null }>(query, { cartId }, { context });
  return data.cart;
}

/**
 * Change le pays d'un panier existant.
 *
 * Indispensable au changement de marché en cours de session : le pays est
 * mémorisé SUR le panier, `@inContext` ne le rétroagit pas. Shopify reconvertit
 * alors les lignes et le checkout dans la devise du nouveau pays.
 */
export async function updateCartBuyerIdentity(
  cartId: string,
  countryCode: string,
  context?: ShopifyContext
) {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartBuyerIdentityUpdate($cartId: ID!, $countryCode: CountryCode!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: { countryCode: $countryCode }) {
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
    cartBuyerIdentityUpdate: { cart: ShopifyCart | null; userErrors: CartUserError[] };
  }>(query, { cartId, countryCode }, { context });

  assertNoUserErrors(data.cartBuyerIdentityUpdate.userErrors);
  return data.cartBuyerIdentityUpdate.cart;
}

/** Ajoute une ou plusieurs lignes à un panier existant (fusionne les quantités si déjà présentes) */
export async function addCartLine(
  cartId: string,
  lines: CartLineInput[],
  context?: ShopifyContext
) {
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
  }>(query, { cartId, lines }, { context });

  assertNoUserErrors(data.cartLinesAdd.userErrors);
  assertNoStockWarnings(data.cartLinesAdd.warnings);
  return data.cartLinesAdd.cart;
}

/*
 * `merchandiseId` est optionnel : le fournir REMPLACE la variante de la ligne.
 * C'est ce qui permet de changer l'échantillon offert en une seule mutation,
 * au lieu d'un retrait suivi d'un ajout.
 */
export type CartLineUpdateInput = { id: string; quantity: number; merchandiseId?: string };

/** Modifie la quantité d'une ou plusieurs lignes d'un panier existant */
export async function updateCartLines(
  cartId: string,
  lines: CartLineUpdateInput[],
  context?: ShopifyContext
) {
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
  }>(query, { cartId, lines }, { context });

  assertNoUserErrors(data.cartLinesUpdate.userErrors);
  assertNoStockWarnings(data.cartLinesUpdate.warnings);
  return data.cartLinesUpdate.cart;
}

/** Retire une ligne d'un panier existant */
export async function removeCartLine(cartId: string, lineId: string, context?: ShopifyContext) {
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
  }>(query, { cartId, lineIds: [lineId] }, { context });

  assertNoUserErrors(data.cartLinesRemove.userErrors);
  return data.cartLinesRemove.cart;
}

/**
 * Variantes responsives d'une image servie par le CDN Shopify.
 *
 * Le CDN accepte un paramètre `width` et renvoie l'image redimensionnée (et
 * réencodée dans un format adapté au navigateur). Sans ce paramètre il sert le
 * fichier d'origine : un rendu de flacon en 2346x2884 pèse 7,4 Mo et partait
 * tel quel dans une tuile de 287 px. Le même en `?width=320` fait 143 Ko.
 *
 * Pendant de responsiveImage() côté Sanity (voir src/lib/sanity.ts). Ici pas
 * de recadrage : on ne touche qu'à la largeur, le ratio est préservé et c'est
 * le CSS (object-fit) qui cadre.
 *
 * `native` est la largeur réelle du fichier (Shopify la renvoie dans ses
 * requêtes) : on ne propose pas de palier au-dessus, le CDN n'agrandit pas et
 * on paierait le poids de l'original pour rien.
 */
export function shopifyImage(
  image: Pick<ShopifyImage, "url"> & Partial<Pick<ShopifyImage, "width">>,
  widths: number[]
): { src: string; srcset: string } {
  const at = (w: number) => {
    const u = new URL(image.url);
    u.searchParams.set("width", String(w));
    return u.href;
  };

  const sorted = [...new Set(widths)].sort((a, b) => a - b);
  const native = image.width;
  let usable = native ? sorted.filter((w) => w <= native) : sorted;
  // Source plus petite que le plus petit palier : on garde ce palier plutôt
  // que de renvoyer une liste vide (le CDN plafonnera de lui-même).
  if (usable.length === 0) usable = [sorted[0]];
  // La largeur native complète la liste quand elle tombe entre deux paliers,
  // sinon une source de 958 px resterait servie au palier 720.
  else if (native && native < sorted[sorted.length - 1] && !usable.includes(native)) {
    usable = [...usable, native];
  }

  return {
    src: at(usable[usable.length - 1]),
    srcset: usable.map((w) => `${at(w)} ${w}w`).join(", "),
  };
}
