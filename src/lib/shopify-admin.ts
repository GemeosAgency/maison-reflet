/**
 * Le peu d'Admin API dont le site a besoin : créer le code d'avoir du coffret.
 *
 * Volontairement séparé de lib/shopify.ts, qui ne parle que la Storefront API
 * avec un token public. Ici le token est un secret serveur : il ne doit jamais
 * être préfixé PUBLIC_, ni traverser le navigateur.
 *
 * Sans SHOPIFY_ADMIN_TOKEN, les fonctions renoncent proprement et disent
 * pourquoi : le site continue de tourner, seul l'avoir n'est pas émis. C'est
 * voulu — le webhook des commandes alimente aussi Meta, GA4 et la tour de
 * contrôle, et il ne doit pas tomber parce qu'un token manque.
 */
const DOMAIN = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = import.meta.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = import.meta.env.PUBLIC_SHOPIFY_API_VERSION ?? "2025-10";

export const adminPret = () => Boolean(DOMAIN && TOKEN);

async function admin<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!adminPret()) {
    console.warn("[shopify-admin] SHOPIFY_ADMIN_TOKEN manquant : l'avoir n'est pas émis.");
    return null;
  }
  const res = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    console.error("[shopify-admin] HTTP", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) {
    console.error("[shopify-admin] GraphQL", JSON.stringify(json.errors).slice(0, 300));
    return null;
  }
  return json.data ?? null;
}

const CHERCHE_PRODUITS = `
  query produits($q: String!) {
    products(first: 20, query: $q) { nodes { id handle } }
  }
`;

/** Les identifiants Admin des Reflets, pour borner l'avoir aux flacons. */
export async function idsProduits(handles: readonly string[]): Promise<string[]> {
  const q = handles.map((h) => `handle:${h}`).join(" OR ");
  const d = await admin<{ products: { nodes: { id: string; handle: string }[] } }>(CHERCHE_PRODUITS, { q });
  if (!d) return [];
  const connus = new Set(handles);
  return d.products.nodes.filter((n) => connus.has(n.handle)).map((n) => n.id);
}

const CREE_CODE = `
  mutation creeAvoir($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message code }
    }
  }
`;

export type Avoir = {
  code: string;
  montant: number;
  devise: string;
  minimum: number;
  produits: string[];
  fin: Date;
  titre: string;
};

export type Emission = "cree" | "existe" | "impossible";

/**
 * Crée le code d'avoir. Renvoie « existe » si Shopify le connaît déjà : c'est
 * le cas normal d'un webhook rejoué, pas une erreur.
 */
export async function creerAvoir(a: Avoir): Promise<Emission> {
  const d = await admin<{
    discountCodeBasicCreate: { userErrors: { message: string; code?: string }[] };
  }>(CREE_CODE, {
    basicCodeDiscount: {
      title: a.titre,
      code: a.code,
      startsAt: new Date().toISOString(),
      endsAt: a.fin.toISOString(),
      usageLimit: 1,
      appliesOncePerCustomer: true,
      customerSelection: { all: true },
      customerGets: {
        value: { discountAmount: { amount: a.montant, appliesOnEachItem: false } },
        items: a.produits.length ? { products: { productsToAdd: a.produits } } : { all: true },
      },
      minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: a.minimum } },
    },
  });
  if (!d) return "impossible";
  const erreurs = d.discountCodeBasicCreate.userErrors ?? [];
  if (!erreurs.length) return "cree";
  // « Code must be unique » : la commande a déjà reçu son avoir.
  if (erreurs.some((e) => /unique|taken|already/i.test(e.message))) return "existe";
  console.error("[shopify-admin] avoir refusé :", JSON.stringify(erreurs).slice(0, 300));
  return "impossible";
}
