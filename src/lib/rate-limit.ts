/**
 * Garde-fous des routes publiques qui coûtent quelque chose (Klaviyo, Anthropic) :
 * d'où vient la requête, et combien elle en a envoyé.
 *
 * Côté serveur uniquement.
 */

/*
 * Les sites qui ont le droit d'appeler nos formulaires : la prod, le staging
 * et le développement local. La page elle-même (même hôte que la requête)
 * passe toujours : c'est ce qui couvre les previews Vercel, chacune appelant
 * sa propre API. Pas de motif *.vercel.app : n'importe qui peut ouvrir un
 * projet « maison-reflet-… » chez Vercel.
 */
const ALLOWED_HOSTS = new Set(["maisonreflet.com", "www.maisonreflet.com", "staging.maisonreflet.com"]);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Vrai si la requête vient d'une de nos pages. L'en-tête Origin d'abord (le
 * navigateur l'envoie sur tout POST), sinon le Referer ; sans l'un ni l'autre,
 * c'est un script, pas un visiteur : refusé.
 */
export function fromOurSite(request: Request): boolean {
  const host = hostOf(request.headers.get("origin")) ?? hostOf(request.headers.get("referer"));
  if (!host) return false;
  if (host === hostOf(request.url)) return true;
  return ALLOWED_HOSTS.has(host) || LOCAL_HOST.test(host);
}

/**
 * L'adresse IP réelle du visiteur. Sur Vercel, `x-real-ip` et
 * `x-forwarded-for` sont posés par l'infrastructure et écrasent ce que le
 * client aurait envoyé : on peut s'y fier, contrairement à un identifiant
 * fourni par le navigateur. Repli sur l'adresse vue par l'adaptateur.
 */
export function clientIp(request: Request, fallback?: string | null): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || fallback || "unknown";
}

/*
 * Compteur en mémoire, par instance de fonction. Il ne voit pas les autres
 * instances : c'est un premier filet, pas une garantie. Le vrai rempart
 * contre une rafale est la règle de pare-feu Vercel par IP ; Luma compte en
 * plus dans sa base (voir api/luma/chat.ts).
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

/** Enregistre un appel ; faux si `key` a déjà fait `limit` appels sur la fenêtre. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // La table ne grossit jamais sans fin : on oublie les clés les plus anciennes.
  if (hits.size > MAX_KEYS) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size <= MAX_KEYS / 2) break;
    }
  }
  return true;
}

/**
 * Empreinte d'une IP pour la compter en base sans la stocker : HMAC avec un
 * secret serveur et la date du jour (UTC), tronqué. Illisible, et impossible
 * à relier d'un jour à l'autre.
 */
export async function ipFingerprint(ip: string, secret: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${day}|${ip}`)));
  return Array.from(sig.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
