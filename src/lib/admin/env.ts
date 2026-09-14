/**
 * Production ou pas ? « Tout ce qui est fait sur staging va dans Test, même le
 * trafic, comme ça on ne pollue pas » (Sandro, 14 septembre 2026).
 *
 * Le seul environnement réel est le site public : maisonreflet.com. Staging,
 * les previews Vercel et le développement local marquent leurs événements,
 * leurs conversations et leurs commandes comme des données de test.
 */
const PRODUCTION_HOSTS = new Set(["maisonreflet.com", "www.maisonreflet.com"]);

/** Vrai quand l'hôte n'est pas le site de production (staging, preview, localhost). */
export function isTestHost(host: string | null | undefined): boolean {
  if (!host) return true;
  const clean = host.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return !PRODUCTION_HOSTS.has(clean);
}

/** L'hôte d'une requête : l'origine quand elle est là (fetch même origine), sinon l'en-tête host. */
export function requestIsTest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = origin ?? request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return isTestHost(host);
}
