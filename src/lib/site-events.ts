/**
 * Les événements du site pour la tour de contrôle (/api/site-events) : un
 * appel qui ne bloque rien et n'échoue jamais visiblement. L'identifiant est
 * aléatoire, posé dans le navigateur (localStorage `mr_anon`) — pas un email,
 * pas une adresse IP ; il ne sert qu'à compter des parcours.
 */
const KEY = "mr_anon";

function anonId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anonymous-visitor";
  }
}

export function trackSite(name: string, props: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ name, props, anon: anonId(), path: window.location.pathname, locale: document.documentElement.lang || null });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/site-events", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/site-events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* le suivi ne doit jamais gêner la page */
  }
}
