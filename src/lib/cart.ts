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
  updateCartLines,
  updateCartAttributes,
  type CartAttributeInput,
  type ShopifyCart,
} from "./shopify";
import { track as trackKlaviyo } from "./klaviyo";
import {
  getMetaBrowserIds,
  metaAddToCart,
  metaInitiateCheckout,
  shopifyNumericId,
} from "./meta";
import { getGa4ClientId, ga4AddToCart, ga4BeginCheckout } from "./ga4";

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

/**
 * Ouvre le panier latéral (écouté par CartDrawer.astro, présent dans le
 * Layout donc sur toutes les pages).
 *
 * Émis depuis addManyToCart() et NON depuis chaque bouton : il y a quatre
 * chemins d'ajout au panier (la délégation [data-add-to-cart] plus bas, le
 * panneau de la fiche produit avec sa quantité, le sélecteur d'échantillon et
 * les cartes upsell du tiroir). Les câbler un par un, c'est en oublier un au
 * prochain composant.
 *
 * Sans effet si le tiroir est déjà ouvert — c'est le cas des ajouts faits
 * DEPUIS le tiroir (échantillon, upsell) et de la page /panier.
 */
function openCartDrawer() {
  document.dispatchEvent(new CustomEvent("cart:open"));
}

/** Préfixe de langue courant (/fr, /ar, /en) déduit de l'URL, pour reconstruire un lien produit absolu. */
function currentLangPrefix(): string {
  const match = window.location.pathname.match(/^\/(fr|ar|en)(?:\/|$)/);
  return match ? `/${match[1]}` : "/fr";
}

/** Attributs de tracking (_fbp/_fbc Meta, _ga GA4) à attacher au panier — vide pour tout tracker désactivé. */
function trackingCartAttributes(): CartAttributeInput[] {
  const { fbp, fbc } = getMetaBrowserIds();
  const ga4ClientId = getGa4ClientId();
  const attributes: CartAttributeInput[] = [];
  if (fbp) attributes.push({ key: "_fbp", value: fbp });
  if (fbc) attributes.push({ key: "_fbc", value: fbc });
  if (ga4ClientId) attributes.push({ key: "_ga", value: ga4ClientId });
  return attributes;
}

/** Événements "Added to Cart" Klaviyo + AddToCart Meta (best effort — jamais bloquant) */
function trackAddedToCart(cart: ShopifyCart, lines: CartLine[]) {
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
        VariantId: l.variantId,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (addedItems.length === 0) return;

  const value = addedItems.reduce((sum, l) => sum + l.Price * l.Quantity, 0);

  const first = addedItems[0];
  try {
    trackKlaviyo("Added to Cart", {
      $value: value,
      AddedItemProductName: first.ProductName,
      AddedItemVariantTitle: first.VariantTitle,
      AddedItemPrice: first.Price,
      AddedItemQuantity: first.Quantity,
      AddedItemImageURL: first.ImageURL,
      AddedItemURL: first.ProductURL,
      ItemNames: addedItems.map((l) => l.ProductName),
      CheckoutURL: cart.checkoutUrl,
      Items: addedItems.map(({ VariantId: _, ...item }) => item),
    });
  } catch {
    // le tracking ne doit jamais faire échouer l'ajout au panier
  }

  try {
    metaAddToCart({
      contents: addedItems.map((l) => ({
        id: shopifyNumericId(l.VariantId),
        quantity: l.Quantity,
        item_price: l.Price,
      })),
      value,
      currency: cart.cost.subtotalAmount.currencyCode,
    });
  } catch {
    // idem : jamais bloquant
  }

  try {
    ga4AddToCart({
      items: addedItems.map((l) => ({
        item_id: shopifyNumericId(l.VariantId),
        item_name: l.ProductName,
        price: l.Price,
        quantity: l.Quantity,
      })),
      value,
      currency: cart.cost.subtotalAmount.currencyCode,
    });
  } catch {
    // idem : jamais bloquant
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

export type AddToCartOptions = {
  /**
   * Ouvrir le tiroir après l'ajout. Vrai par défaut : un ajout est presque
   * toujours un geste du visiteur. À passer à `false` pour un ajout
   * TECHNIQUE — la réconciliation de l'échantillon offert (voir
   * ensureSampleLine dans CartDrawer) passe elle aussi par addToCart et peut
   * se déclencher au chargement de la page : le panier n'a alors aucune
   * raison de surgir tout seul.
   */
  openDrawer?: boolean;
};

/** Ajoute une ou plusieurs lignes au panier (ex : lot Buy 2 Get 1 Free), en créant le panier au premier ajout */
export async function addManyToCart(
  lines: CartLine[],
  options: AddToCartOptions = {}
): Promise<ShopifyCart> {
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
    // Les ids de tracking (_fbp/_fbc, _ga) voyagent avec le panier jusqu'à
    // la commande — voir trackingCartAttributes() et le webhook shopify-orders.
    const created = await createCart(shopifyLines, trackingCartAttributes());
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
  if (options.openDrawer !== false) openCartDrawer();
  trackAddedToCart(cart, lines);
  return cart;
}

/** Ajoute une variante au panier, en créant le panier au premier ajout */
export async function addToCart(
  variantId: string,
  quantity = 1,
  options: AddToCartOptions = {}
): Promise<ShopifyCart> {
  return addManyToCart([{ variantId, quantity }], options);
}

/** Retire une ligne du panier courant */
export async function removeFromCart(lineId: string): Promise<ShopifyCart | null> {
  const cartId = getStoredCartId();
  if (!cartId) return null;

  const cart = await removeCartLine(cartId, lineId);
  notifyCartUpdated(cart);
  return cart;
}

/** Modifie la quantité d'une ligne (0 = équivalent à un retrait) */
export async function updateCartLineQuantity(
  lineId: string,
  quantity: number
): Promise<ShopifyCart | null> {
  const cartId = getStoredCartId();
  if (!cartId) return null;

  const cart =
    quantity <= 0
      ? await removeCartLine(cartId, lineId)
      : await updateCartLines(cartId, [{ id: lineId, quantity }]);
  notifyCartUpdated(cart);
  return cart;
}

/**
 * Fixe la quantité TOTALE d'une variante donnée, tous azimuts.
 *
 * Une remise automatique Shopify (ex "2 achetés, le 3e offert") peut scinder
 * une même variante en plusieurs lignes de panier (unités payantes + unité à
 * 0 remisée) — ne toucher qu'une seule de ces lignes laisserait les autres
 * inchangées et fausserait le total. On envoie donc, dans UNE SEULE mutation,
 * la quantité voulue sur la première ligne et 0 sur les suivantes : Shopify
 * repart d'un état propre et rescinde la remise lui-même.
 *
 * Cette version tient en un aller-retour. La précédente en faisait trois
 * (getCart, puis un retrait PAR ligne, puis un ajout) et l'écran ne bougeait
 * qu'à la fin : c'est ce qui rendait les boutons +/- du tiroir si lents.
 *
 * `knownCart` supprime le getCart quand l'appelant connaît déjà le panier
 * affiché — c'est le cas du tiroir.
 */
export async function setVariantQuantity(
  variantId: string,
  quantity: number,
  knownCart?: ShopifyCart | null
): Promise<ShopifyCart | null> {
  const cartId = getStoredCartId();
  if (!cartId) return null;

  const base = knownCart ?? (await getCart(cartId));
  const matching = (base?.lines.nodes ?? []).filter((l) => l.merchandise.id === variantId);

  let cart: ShopifyCart | null = base;
  if (matching.length === 0) {
    if (quantity > 0) {
      cart = (await addCartLine(cartId, [{ merchandiseId: variantId, quantity }])) ?? cart;
    }
  } else {
    // Quantité 0 sur une ligne = suppression de la ligne côté Shopify, d'où
    // le même chemin pour le retrait complet que pour un simple ajustement.
    cart = await updateCartLines(
      cartId,
      matching.map((line, i) => ({ id: line.id, quantity: i === 0 ? Math.max(0, quantity) : 0 }))
    );
  }

  notifyCartUpdated(cart);
  return cart;
}

/**
 * À appeler au clic sur le lien checkout (voir CartDrawer.astro), SANS
 * bloquer la navigation :
 *  - événements InitiateCheckout (Meta) / begin_checkout (GA4) — sendBeacon
 *    ou fbq/gtag en file, survivent au départ ;
 *  - rafraîchissement fire-and-forget des attributs de tracking du panier
 *    (keepalive) — couvre le visiteur revenu via une pub (fbclid) APRÈS la
 *    création du panier : sans ça, le Purchase du webhook ne serait pas
 *    attribuable au clic publicitaire. Si la mutation n'aboutit pas avant que
 *    Shopify fige le checkout, les attributs posés à la création restent.
 */
export function trackCheckoutDeparture(cart: ShopifyCart | null) {
  if (!cart || cart.lines.nodes.length === 0) return;

  const value = Number(cart.cost.subtotalAmount.amount);
  const currency = cart.cost.subtotalAmount.currencyCode;

  try {
    metaInitiateCheckout({
      contents: cart.lines.nodes.map((line) => ({
        id: shopifyNumericId(line.merchandise.id),
        quantity: line.quantity,
        item_price: Number(line.merchandise.price.amount),
      })),
      value,
      currency,
    });
  } catch {
    // le tracking ne doit jamais bloquer le départ vers le checkout
  }

  try {
    ga4BeginCheckout({
      items: cart.lines.nodes.map((line) => ({
        item_id: shopifyNumericId(line.merchandise.id),
        item_name: line.merchandise.product.title,
        price: Number(line.merchandise.price.amount),
        quantity: line.quantity,
      })),
      value,
      currency,
    });
  } catch {
    // idem : jamais bloquant
  }

  const attributes = trackingCartAttributes();
  if (attributes.length) {
    updateCartAttributes(cart.id, attributes, { keepalive: true }).catch(() => {});
  }
}

/**
 * Câble tous les boutons `[data-add-to-cart]` de la page (cartes produit,
 * cartes coffret…) via délégation d'événement sur `document`. Un seul appel
 * global (voir Layout.astro) plutôt qu'un `querySelectorAll` par page/composant :
 * avec plusieurs composants de carte partagés sur une même page, des écouteurs
 * attachés individuellement se dupliqueraient sur les boutons rendus par
 * chacun. La délégation gère aussi nativement les boutons ajoutés après coup.
 */
export function initAddToCartButtons() {
  document.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>("[data-add-to-cart]");
    if (!btn || btn.disabled) return;
    e.preventDefault();

    const variantId = btn.dataset.variantId;
    if (!variantId) return;

    const feedback = btn.parentElement?.querySelector<HTMLElement>("[data-feedback]") ?? null;
    const inlineLabel = btn.querySelector<HTMLElement>("[data-reco-add-label]");
    const inlineLabelDefault = inlineLabel?.textContent ?? "";
    // Libellés fournis par le composant appelant (donc traduits). Les valeurs
    // par défaut ne servent qu'aux boutons qui n'en passent pas encore.
    const addedLabel = btn.dataset.addedLabel || "AJOUTÉ ✓";
    const errorLabel = btn.dataset.errorLabel || "ERREUR";

    btn.disabled = true;
    try {
      await addToCart(variantId, 1);
      if (feedback) feedback.textContent = "✓";
      if (inlineLabel) {
        inlineLabel.textContent = addedLabel;
        setTimeout(() => (inlineLabel.textContent = inlineLabelDefault), 1600);
      }
    } catch (error) {
      console.error(error);
      if (feedback) feedback.textContent = "×";
      if (inlineLabel) {
        inlineLabel.textContent = errorLabel;
        setTimeout(() => (inlineLabel.textContent = inlineLabelDefault), 1600);
      }
    } finally {
      btn.disabled = false;
    }
  });
}
