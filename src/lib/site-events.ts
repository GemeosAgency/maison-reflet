/**
 * Les événements du site pour la tour de contrôle (/api/site-events) : un
 * appel qui ne bloque rien et n'échoue jamais visiblement. L'identifiant est
 * aléatoire, posé dans le navigateur (localStorage `mr_anon`) — pas un email,
 * pas une adresse IP ; il ne sert qu'à compter des parcours.
 */
const KEY = "mr_anon";

export function anonId(): string {
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

/**
 * La vue de page, avec ce qui fait une source : le site d'où l'on vient et les
 * utm de la première page d'une visite (`landing`), l'appareil (grossier :
 * tactile ou non), la largeur d'écran par palier. Rien d'identifiant.
 */
export function trackPageView(): void {
  try {
    const first = !sessionStorage.getItem("mr_landed");
    if (first) sessionStorage.setItem("mr_landed", "1");
    const u = new URL(window.location.href);
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = u.searchParams.get(k);
      if (v) utm[k.slice(4)] = v.slice(0, 80);
    }
    let ref: string | null = null;
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      ref = r && r.host !== window.location.host ? r.host.replace(/^www\./, "") : null;
    } catch {
      ref = null;
    }
    const w = window.innerWidth;
    trackSite("page_view", {
      landing: first,
      ref: first ? ref : null,
      utm: first && Object.keys(utm).length ? utm : null,
      device: matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop",
      screen: w < 600 ? "s" : w < 1100 ? "m" : "l",
    });
  } catch {
    /* jamais bloquant */
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
