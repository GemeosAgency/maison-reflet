/**
 * Envoi d'événements Klaviyo (tracking onsite) depuis le navigateur.
 *
 * LE PROBLÈME (diagnostiqué en réel)
 * ----------------------------------
 * klaviyo.js est chargé en `async` depuis le CDN (voir Layout.astro). Au
 * chargement d'une page, `window.klaviyo` apparaît AVEC ses méthodes mais AVANT
 * d'être réellement initialisé : un `track` émis pendant cette fenêtre est perdu
 * silencieusement (erreurs console "Unable to process event: then,…"). C'est
 * pourquoi "Viewed Product" (émis au chargement) ne remontait jamais, alors que
 * "Added to Cart" (émis sur clic, donc plus tard, klaviyo déjà prêt) remontait.
 *
 * Piège supplémentaire : on ne peut PAS attendre un signal "prêt" en awaitant
 * une méthode klaviyo (ex : `isIdentified()`), car à froid ces appels renvoient
 * un proxy dont le `.then` est intercepté — l'`await` ne se résout jamais et le
 * code qui suit n'est jamais atteint.
 *
 * LA SOLUTION : ré-émission idempotente
 * -------------------------------------
 * On ré-émet l'événement plusieurs fois espacées sur ~13s (via setTimeout, SANS
 * aucun await sur klaviyo). Les tirs émis avant que klaviyo soit prêt échouent,
 * mais un tir plus tardif aboutit. Un `$event_id` stable (généré une seule fois
 * par appel) rend l'opération idempotente : Klaviyo fusionne les tirs en un
 * unique événement (dédoublonnage vérifié en réel). Aucun doublon, robuste quel
 * que soit le temps de chargement de klaviyo.js.
 */

type KlaviyoObject = {
  track: (event: string, properties?: Record<string, unknown>) => unknown;
  identify: (properties: Record<string, unknown>) => unknown;
};

// Instants de ré-émission (ms depuis l'appel). Couvre un chargement lent de
// klaviyo.js tout en émettant tout de suite si déjà prêt.
const RETRY_SCHEDULE_MS = [0, 1500, 3000, 4500, 6000, 8000, 10000, 13000];

/** L'objet klaviyo.js s'il expose ses méthodes, sinon null. */
function getKlaviyo(): KlaviyoObject | null {
  const k = (window as typeof window & { klaviyo?: unknown }).klaviyo;
  if (k && !Array.isArray(k) && typeof (k as KlaviyoObject).track === "function") {
    return k as KlaviyoObject;
  }
  return null;
}

/**
 * Ré-émet `fn` selon RETRY_SCHEDULE_MS tant que klaviyo n'est pas exploitable.
 * `fn` reçoit l'objet klaviyo. Les erreurs sont avalées (best effort).
 */
function emitWithRetries(fn: (klaviyo: KlaviyoObject) => void) {
  for (const delay of RETRY_SCHEDULE_MS) {
    setTimeout(() => {
      const klaviyo = getKlaviyo();
      if (!klaviyo) return;
      try {
        fn(klaviyo);
      } catch {
        // le tracking ne doit jamais faire échouer la page
      }
    }, delay);
  }
}

/** Identifiant d'événement stable pour rendre les ré-émissions idempotentes. */
function makeEventId(event: string): string {
  return `${event}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/** Envoie un événement (best effort, idempotent via $event_id). */
export function track(event: string, properties: Record<string, unknown> = {}) {
  const payload = { ...properties, $event_id: makeEventId(event) };
  emitWithRetries((klaviyo) => klaviyo.track(event, payload));
}

/** Identifie le profil courant (best effort). */
export function identify(properties: Record<string, unknown>) {
  emitWithRetries((klaviyo) => klaviyo.identify(properties));
}
