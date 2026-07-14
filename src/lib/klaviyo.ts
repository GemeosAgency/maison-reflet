/**
 * Envoi d'événements Klaviyo (tracking onsite) depuis le navigateur.
 *
 * POURQUOI ON ATTEND QUE klaviyo.js SOIT VRAIMENT PRÊT AVANT D'ÉMETTRE
 * -------------------------------------------------------------------
 * klaviyo.js est chargé en `async` depuis le CDN (voir Layout.astro) et met
 * quelques secondes à s'initialiser. Deux pièges vérifiés empiriquement :
 *  1. `window.klaviyo` apparaît (avec ses méthodes) AVANT la fin de son
 *     initialisation ; un événement émis pendant cette fenêtre est perdu
 *     silencieusement (erreurs console "Unable to process event: then,…").
 *  2. Une fois l'init terminée, tout émission fonctionne à tous les coups.
 *
 * C'est ce qui faisait que "Viewed Product" (émis au chargement de page) ne
 * remontait jamais, alors que "Added to Cart" (émis sur clic, donc plus tard,
 * klaviyo.js déjà prêt) remontait bien.
 *
 * `isIdentified()` renvoie une promesse qui n'aboutit qu'une fois klaviyo.js
 * réellement initialisé : l'attendre fait le pont jusqu'à l'état "prêt", après
 * quoi on émet via les méthodes objet `track` / `identify`.
 */

type KlaviyoObject = {
  push: (args: unknown[]) => void;
  track: (event: string, properties?: Record<string, unknown>) => unknown;
  identify: (properties: Record<string, unknown>) => unknown;
  isIdentified: () => Promise<unknown>;
};

/**
 * Renvoie l'objet klaviyo.js une fois qu'il expose ses méthodes, sinon null.
 * Avant chargement, `window.klaviyo` est `undefined` (ou une file tableau
 * transitoire) : dans ces cas ce n'est pas encore exploitable.
 */
function getKlaviyo(): KlaviyoObject | null {
  const k = (window as typeof window & { klaviyo?: unknown }).klaviyo;
  if (k && !Array.isArray(k) && typeof (k as KlaviyoObject).track === "function") {
    return k as KlaviyoObject;
  }
  return null;
}

/**
 * Patiente jusqu'à ce que klaviyo.js soit chargé ET initialisé.
 * Timeout large : le script est async et peut mettre plusieurs secondes.
 */
async function waitForReadyKlaviyo(timeoutMs = 20000): Promise<KlaviyoObject | null> {
  const start = Date.now();
  let klaviyo = getKlaviyo();
  while (!klaviyo && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    klaviyo = getKlaviyo();
  }
  if (!klaviyo) return null;

  // Attendre la fin de l'initialisation (voir commentaire d'en-tête).
  try {
    await klaviyo.isIdentified();
  } catch {
    // si l'appel n'aboutit pas, on tente quand même l'émission plus bas
  }
  return klaviyo;
}

/** Envoie un événement (best effort : ne rejette jamais si klaviyo.js manque). */
export async function track(event: string, properties?: Record<string, unknown>) {
  const klaviyo = await waitForReadyKlaviyo();
  try {
    klaviyo?.track(event, properties);
  } catch {
    // le tracking ne doit jamais faire échouer la page
  }
}

/** Identifie le profil courant (best effort). */
export async function identify(properties: Record<string, unknown>) {
  const klaviyo = await waitForReadyKlaviyo();
  try {
    klaviyo?.identify(properties);
  } catch {
    // best effort
  }
}
