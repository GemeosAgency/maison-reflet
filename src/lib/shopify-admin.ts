/**
 * Le peu d'Admin API dont le site a besoin : créer le code d'avoir du coffret.
 *
 * Volontairement séparé de lib/shopify.ts, qui ne parle que la Storefront API
 * avec un token public. Ici le token est un secret serveur : il ne doit jamais
 * être préfixé PUBLIC_, ni traverser le navigateur.
 *
 * Deux façons d'obtenir le token Admin :
 * - SHOPIFY_ADMIN_TOKEN, un token permanent (anciennes apps personnalisées) ;
 * - SHOPIFY_ADMIN_CLIENT_ID + SHOPIFY_ADMIN_CLIENT_SECRET, une app du
 *   tableau de bord développeur : le site échange ces identifiants contre un
 *   token (client credentials grant), valable 24 h, gardé en mémoire et
 *   redemandé avant qu'il expire.
 *
 * Sans l'un ni l'autre, les fonctions renoncent proprement et disent
 * pourquoi : le site continue de tourner, seul l'avoir n'est pas émis. C'est
 * voulu — le webhook des commandes alimente aussi Meta, GA4 et la tour de
 * contrôle, et il ne doit pas tomber parce qu'un token manque.
 */
const DOMAIN = import.meta.env.PUBLIC_SHOPIFY_STORE_DOMAIN;
const STATIC_TOKEN = import.meta.env.SHOPIFY_ADMIN_TOKEN;
const CLIENT_ID = import.meta.env.SHOPIFY_ADMIN_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.SHOPIFY_ADMIN_CLIENT_SECRET;
const VERSION = import.meta.env.PUBLIC_SHOPIFY_API_VERSION ?? "2025-10";

export const adminPret = () => Boolean(DOMAIN && (STATIC_TOKEN || (CLIENT_ID && CLIENT_SECRET)));

export type JetonAdmin = { token: string; scopes: string[]; mode: "permanent" | "client_credentials" };

// Token obtenu par client credentials, réutilisé tant qu'il est valide (une
// instance serverless chaude évite ainsi un aller-retour par appel).
let jetonEnCache: { token: string; scopes: string[]; expire: number } | null = null;

/** Le token Admin à utiliser, ou null avec la raison dans les logs. */
export async function jetonAdmin(forcer = false): Promise<JetonAdmin | null> {
  if (!DOMAIN) return null;
  if (STATIC_TOKEN) return { token: STATIC_TOKEN, scopes: [], mode: "permanent" };
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  if (!forcer && jetonEnCache && jetonEnCache.expire > Date.now()) {
    return { token: jetonEnCache.token, scopes: jetonEnCache.scopes, mode: "client_credentials" };
  }
  const res = await fetch(`https://${DOMAIN}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) {
    console.error("[shopify-admin] échange client credentials refusé : HTTP", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const j = (await res.json()) as { access_token?: string; scope?: string; expires_in?: number };
  if (!j.access_token) {
    console.error("[shopify-admin] échange client credentials sans access_token.");
    return null;
  }
  const scopes = (j.scope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Marge de 5 min avant l'expiration annoncée (86 399 s en général).
  jetonEnCache = { token: j.access_token, scopes, expire: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 300) * 1000 };
  return { token: j.access_token, scopes, mode: "client_credentials" };
}

async function admin<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!adminPret()) {
    console.warn("[shopify-admin] ni SHOPIFY_ADMIN_TOKEN ni SHOPIFY_ADMIN_CLIENT_ID/SECRET : l'avoir n'est pas émis.");
    return null;
  }
  let jeton = await jetonAdmin();
  if (!jeton) return null;
  const appel = (token: string) =>
    fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });
  let res = await appel(jeton.token);
  // Token révoqué ou expiré plus tôt que prévu : on en redemande un, une fois.
  if (res.status === 401 && jeton.mode === "client_credentials") {
    jeton = await jetonAdmin(true);
    if (!jeton) return null;
    res = await appel(jeton.token);
  }
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
  minimum: number;
  produits: string[];
  /** Le client à qui le code est réservé : personne d'autre ne peut l'utiliser. */
  clientGid: string;
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
      /*
       * `context` remplace `customerSelection`, déprécié depuis 2025 — et il
       * apporte ce qui nous manquait : le code est RÉSERVÉ à son client. Même
       * partagé ou deviné, il ne sert à personne d'autre. Avec usageLimit à 1,
       * l'avoir est donc utilisable une fois, par ce compte, et une seule.
       */
      context: { customers: { add: [a.clientGid] } },
      // Jamais cumulable : l'avoir ne doit pas s'ajouter à une autre remise.
      combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: false },
      customerGets: {
        appliesOnOneTimePurchase: true,
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


const CHERCHE_CODE = `
  query avoir($code: String!) {
    codeDiscountNodeByCode(code: $code) { id }
  }
`;

const DESACTIVE = `
  mutation desactive($id: ID!) {
    discountCodeDeactivate(id: $id) {
      userErrors { field message }
    }
  }
`;

/**
 * Désactive un avoir. Sert quand la commande qui l'a ouvert est annulée ou
 * remboursée : sans ça, on pouvait acheter le coffret, recevoir les 160 AED,
 * se faire rembourser le coffret et garder l'avoir.
 *
 * Renvoie `true` si le code est bien hors service après l'appel, y compris
 * quand il n'existait pas (rien à désactiver, donc rien à craindre).
 */
export async function desactiverAvoir(code: string): Promise<boolean> {
  const d = await admin<{ codeDiscountNodeByCode: { id: string } | null }>(CHERCHE_CODE, { code });
  if (!d) return false;
  const id = d.codeDiscountNodeByCode?.id;
  if (!id) return true;
  const r = await admin<{ discountCodeDeactivate: { userErrors: { message: string }[] } }>(DESACTIVE, { id });
  if (!r) return false;
  const erreurs = r.discountCodeDeactivate.userErrors ?? [];
  // Déjà expiré ou déjà désactivé : c'est le résultat voulu.
  if (erreurs.length && !erreurs.some((e) => /already|expired|inactive/i.test(e.message))) {
    console.error("[shopify-admin] désactivation refusée :", JSON.stringify(erreurs).slice(0, 300));
    return false;
  }
  return true;
}

const CLIENT_DE_COMMANDE = `
  query commande($id: ID!) {
    order(id: $id) { customer { id } }
  }
`;

/** Le client d'une commande : le payload d'un remboursement ne le porte pas. */
export async function clientDeCommande(orderId: number | string): Promise<number | null> {
  const d = await admin<{ order: { customer: { id: string } | null } | null }>(CLIENT_DE_COMMANDE, {
    id: `gid://shopify/Order/${orderId}`,
  });
  const gid = d?.order?.customer?.id;
  if (!gid) return null;
  const n = Number(gid.split("/").pop());
  return Number.isFinite(n) ? n : null;
}
