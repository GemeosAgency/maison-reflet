/**
 * Envoi d'événements Klaviyo (tracking onsite) depuis le navigateur.
 *
 * POURQUOI ON ATTEND QUE klaviyo.js SOIT CHARGÉ AVANT D'ENVOYER
 * ------------------------------------------------------------
 * klaviyo.js est chargé en `async` depuis le CDN (voir Layout.astro) et met
 * quelques secondes à s'initialiser. Tant qu'il n'a pas tourné, son bootstrap
 * de compte (`["account", <id>]`) n'a pas eu lieu : un `track` poussé AVANT ce
 * bootstrap est mis en file mais ignoré au traitement initial — l'événement est
 * perdu silencieusement. C'est ce qui faisait que "Viewed Product" (envoyé au
 * chargement de page) ne remontait jamais, alors que "Added to Cart" (envoyé sur
 * clic, donc plus tard, klaviyo.js déjà prêt) remontait bien.
 *
 * Vérifié empiriquement : une fois `window.klaviyo` chargé (c'est un objet doté
 * de `.push`), pousser `["track", …]` / `["identify", …]` fonctionne à tous les
 * coups. On patiente donc jusqu'à ce que cet objet soit prêt, puis on pousse.
 */

type KlaviyoObject = { push: (args: unknown[]) => void };

/**
 * Renvoie l'objet klaviyo.js UNE FOIS CHARGÉ, sinon null.
 * Avant chargement, `window.klaviyo` est `undefined` (ou une file tableau
 * transitoire) : dans ces cas on considère que ce n'est pas encore prêt.
 */
function loadedKlaviyo(): KlaviyoObject | null {
  const k = (window as typeof window & { klaviyo?: unknown }).klaviyo;
  if (k && !Array.isArray(k) && typeof (k as KlaviyoObject).push === "function") {
    return k as KlaviyoObject;
  }
  return null;
}

/** Patiente jusqu'à ce que klaviyo.js soit chargé (timeout large : CDN async). */
async function waitForKlaviyo(timeoutMs = 20000): Promise<KlaviyoObject | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const k = loadedKlaviyo();
    if (k) return k;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

/** Envoie un événement (best effort : ne rejette jamais si klaviyo.js manque). */
export async function track(event: string, properties?: Record<string, unknown>) {
  const klaviyo = await waitForKlaviyo();
  klaviyo?.push(["track", event, properties]);
}

/** Identifie le profil courant (best effort). */
export async function identify(properties: Record<string, unknown>) {
  const klaviyo = await waitForKlaviyo();
  klaviyo?.push(["identify", properties]);
}
