/**
 * Envoi d'événements Klaviyo (tracking onsite) depuis le navigateur.
 *
 * On pousse toujours via `_learnq.push(...)` plutôt que d'appeler
 * `window.klaviyo.track()` directement : klaviyo.js expose `window.klaviyo`
 * très tôt après le chargement du script, avant d'être pleinement initialisé
 * — un appel direct fait juste après échoue silencieusement (confirmé : le
 * "Viewed Product" au chargement de page ne remontait jamais, alors que les
 * appels déclenchés par un clic utilisateur, plus tardifs, fonctionnaient).
 * `_learnq` est la file d'attente officielle Klaviyo : elle bufferise les
 * appels tant que le script n'est pas prêt, quel que soit le timing.
 */

type LearnqQueue = { push: (entry: unknown[]) => number };

function getLearnq(): LearnqQueue {
  const w = window as typeof window & { _learnq?: LearnqQueue };
  w._learnq = w._learnq ?? ([] as unknown as LearnqQueue);
  return w._learnq;
}

export function track(event: string, properties?: Record<string, unknown>) {
  getLearnq().push(["track", event, properties]);
}

export function identify(properties: Record<string, unknown>) {
  getLearnq().push(["identify", properties]);
}
