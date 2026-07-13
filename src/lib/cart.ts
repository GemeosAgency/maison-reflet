/**
 * État du panier côté client (navigateur uniquement).
 *
 * Principe : Shopify reste la source de vérité du panier (lignes, prix,
 * checkoutUrl). On ne persiste ici que l'id du panier dans localStorage ;
 * tout le reste est relu via la Cart API à chaque besoin. Les appels API
 * restent centralisés dans ./shopify — ce module ne fait qu'orchestrer.
 *
 * Chaque mutation émet un CustomEvent "cart:updated" sur document, avec le
 * panier à jour en detail — c'est ce qu'écoute le compteur du header.
 */

import {
  createCart,
  getCart,
  addCartLine,
  removeCartLine,
  type ShopifyCart,
} from "./shopify";
import type { KlaviyoGlobal } from "./klaviyo";

const CART_ID_KEY = "maison-reflet:cartId";

export type CartUpdatedEvent = CustomEvent<{ cart: ShopifyCart | null }>;

// Repli mémoire quand localStorage est inaccessible (cookies bloqués,
// certaines webviews) : le panier survit alors le temps de la page.
let memoryCartId: string | null = null;

function getStoredCartId(): string | null {
  try {
    return localStorage.getItem(CART_ID_KEY) ?? memoryCartId;
  } catch {
    return memoryCartId;
  }
}

function storeCartId(id: string) {
  memoryCartId = id;
  try {
    localStorage.setItem(CART_ID_KEY, id);
  } catch {
    // storage indisponible : le repli mémoire prend le relais
  }
}

function clearStoredCart() {
  memoryCartId = null;
  try {
    localStorage.removeItem(CART_ID_KEY);
  } catch {
    // rien à nettoyer si le storage est inaccessible
  }
}

function notifyCartUpdated(cart: ShopifyCart | null) {
  document.dispatchEvent(
    new CustomEvent("cart:updated", { detail: { cart } }) satisfies CartUpdatedEvent
  );
}

/** Préfixe de langue courant (/fr, /ar, /en) déduit de l'URL, pour reconstruire un lien produit absolu. */
function currentLangPrefix(): string {
  const match = window.location.pathname.match(/^\/(fr|ar|en)(?:\/|$)/);
  return match ? `/${match[1]}` : "/fr";
}

/** Événement Klaviyo "Added to Cart" (best effort — pas de blocage si klaviyo.js n'est pas chargé) */
function trackAddedToCart(cart: ShopifyCart, lines: CartLine[]) {
  const klaviyo = (window as typeof window & { klaviyo?: KlaviyoGlobal }).klaviyo;
  if (!klaviyo) return;

  const addedItems = lines
    .map((l) => {
      const line = cart.lines.nodes.find((n) => n.merchandise.id === l.variantId);
      if (!line) return null;
      return {
        ProductName: line.merchandise.product.title,
        VariantTitle: line.merchandise.title,
        Price: Number(line.merchandise.price.amount),
        Quantity: l.quantity,
        ImageURL: line.merchandise.product.featuredImage?.url ?? null,
        ProductURL: `${window.location.origin}${currentLangPrefix()}/parfums/${line.merchandise.product.handle}`,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (addedItems.length === 0) return;

  const first = addedItems[0];
  try {
    klaviyo.track("Added to Cart", {
      $value: addedItems.reduce((sum, l) => sum + l.Price * l.Quantity, 0),
      AddedItemProductName: first.ProductName,
      AddedItemVariantTitle: first.VariantTitle,
      AddedItemPrice: first.Price,
      AddedItemQuantity: first.Quantity,
      AddedItemImageURL: first.ImageURL,
      AddedItemURL: first.ProductURL,
      ItemNames: addedItems.map((l) => l.ProductName),
      CheckoutURL: cart.checkoutUrl,
      Items: addedItems,
    });
  } catch {
    // le tracking ne doit jamais faire échouer l'ajout au panier
  }
}

/** Recharge le panier courant depuis Shopify — null si aucun panier ou panier expiré */
export async function loadCart(): Promise<ShopifyCart | null> {
  const cartId = getStoredCartId();
  if (!cartId) return null;

  const cart = await getCart(cartId);
  if (!cart) clearStoredCart(); // panier expiré côté Shopify (~10 jours d'inactivité)
  return cart;
}

export type CartLine = { variantId: string; quantity: number };

/** Ajoute une ou plusieurs lignes au panier (ex : lot Buy 2 Get 1 Free), en créant le panier au premier ajout */
export async function addManyToCart(lines: CartLine[]): Promise<ShopifyCart> {
  const cartId = getStoredCartId();
  const shopifyLines = lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity }));
  let cart: ShopifyCart | null = null;

  if (cartId) {
    try {
      cart = await addCartLine(cartId, shopifyLines);
    } catch (error) {
      // Ne repartir sur un panier neuf que si le panier n'existe vraiment
      // plus côté Shopify. Toute autre erreur (réseau, rate-limit, userError
      // métier) remonte telle quelle SANS détruire la référence au panier :
      // effacer l'id ici ferait perdre son panier au client sur une simple
      // coupure réseau.
      let existing: ShopifyCart | null;
      try {
        existing = await getCart(cartId);
      } catch {
        throw error;
      }
      if (existing) throw error;
      clearStoredCart();
    }
  }

  if (!cart) {
    const created = await createCart(shopifyLines);
    if (!created) throw new Error("Impossible de créer le panier Shopify");
    cart = created;

    // Un autre onglet a pu créer un panier pendant le createCart : on fusionne
    // l'article dans ce panier-là plutôt que d'écraser sa référence (le panier
    // créé ici est alors abandonné et expirera de lui-même côté Shopify).
    const concurrentId = getStoredCartId();
    if (concurrentId && concurrentId !== created.id) {
      try {
        cart = (await addCartLine(concurrentId, shopifyLines)) ?? created;
      } catch {
        cart = created;
      }
    }
    if (cart === created) storeCartId(created.id);
  }

  notifyCartUpdated(cart);
  trackAddedToCart(cart, lines);
  return cart;
}

/** Ajoute une variante au panier, en créant le panier au premier ajout */
export async function addToCart(variantId: string, quantity = 1): Promise<ShopifyCart> {
  return addManyToCart([{ variantId, quantity }]);
}

/** Retire une ligne du panier courant */
export async function removeFromCart(lineId: string): Promise<ShopifyCart | null> {
  const cartId = getStoredCartId();
  if (!cartId) return null;

  const cart = await removeCartLine(cartId, lineId);
  notifyCartUpdated(cart);
  return cart;
}
