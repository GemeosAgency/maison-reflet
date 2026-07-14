/**
 * Tracking Klaviyo côté navigateur — aiguillage client/serveur.
 *
 * DEUX OBSTACLES CONNUS (diagnostiqués en réel sur ce projet) :
 *  1. klaviyo.js est chargé en `async` : `window.klaviyo` apparaît AVEC ses
 *     méthodes avant d'être réellement initialisé. Un `track` émis dans cette
 *     fenêtre est perdu silencieusement, et awaiter une méthode klaviyo
 *     (ex. isIdentified()) se bloque à froid — le proxy intercepte le `.then`.
 *     Parade : ré-émission espacée sans await + `$event_id` stable (Klaviyo
 *     dédoublonne, vérifié en réel).
 *  2. Les bloqueurs de contenu bloquent *.klaviyo.com : klaviyo.js ne charge
 *     jamais (window.klaviyo reste un Proxy inerte) et RIEN ne remonte.
 *     Parade : relais first-party /api/events (même domaine, non bloqué) qui
 *     transmet à l'API serveur Klaviyo. Voir src/pages/api/events.ts.
 *
 * AIGUILLAGE (chaque événement passe par UN seul chemin — pas de doublon) :
 *  - visiteur identifié (email connu de nous : newsletter, ?utm_email=…) →
 *    envoi direct au relais serveur : insensible aux bloqueurs ;
 *  - visiteur anonyme → tentative klaviyo.js (s'il charge, l'événement est
 *    rattaché à son cookie anonyme et ressortira à l'identification) ET copie
 *    dans une file locale (localStorage). À l'identification, la file est
 *    rejouée vers le serveur avec les horodatages d'origine — UNIQUEMENT pour
 *    les entrées que klaviyo.js n'avait pas pu livrer (bloqueur). Le
 *    `unique_id` partagé sert de filet : Klaviyo fusionne tout doublon.
 *
 * On ne crée jamais de profil Klaviyo anonyme (facturation au profil actif).
 */

type KlaviyoObject = {
  track: (event: string, properties?: Record<string, unknown>) => unknown;
  identify: (properties: Record<string, unknown>) => unknown;
};

// Instants de ré-émission klaviyo.js (ms). Couvre un chargement lent du script.
const RETRY_SCHEDULE_MS = [0, 1500, 3000, 4500, 6000, 8000, 10000, 13000];

const EMAIL_KEY = "maison-reflet:klaviyoEmail";
const QUEUE_KEY = "maison-reflet:klaviyoQueue";
const QUEUE_MAX = 50;
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // aligné sur le relais serveur

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type QueuedEvent = {
  event: string;
  properties: Record<string, unknown>;
  uniqueId: string;
  time: string; // ISO — horodatage d'origine, rejoué tel quel
  clientDelivered?: boolean; // true si klaviyo.js a pu le livrer lui-même
};

// ---------- Identité first-party (repli mémoire si localStorage indisponible) ----------

let memoryEmail: string | null = null;

function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? memoryEmail;
  } catch {
    return memoryEmail;
  }
}

function storeEmail(email: string) {
  memoryEmail = email;
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // repli mémoire : l'identité survit le temps de la page
  }
}

// ---------- File locale des événements anonymes ----------

let memoryQueue: QueuedEvent[] = [];

function loadQueue(): QueuedEvent[] {
  let queue: QueuedEvent[];
  try {
    queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    if (!Array.isArray(queue)) queue = [];
  } catch {
    queue = memoryQueue;
  }
  const cutoff = Date.now() - QUEUE_TTL_MS;
  return queue.filter((e) => e && typeof e.time === "string" && Date.parse(e.time) > cutoff);
}

function saveQueue(queue: QueuedEvent[]) {
  memoryQueue = queue;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_MAX)));
  } catch {
    // repli mémoire uniquement
  }
}

function markClientDelivered(uniqueId: string) {
  const queue = loadQueue();
  const entry = queue.find((e) => e.uniqueId === uniqueId);
  if (entry) {
    entry.clientDelivered = true;
    saveQueue(queue);
  }
}

// ---------- klaviyo.js (chemin client) ----------

/** L'objet klaviyo.js s'il expose ses méthodes, sinon null. */
function getKlaviyo(): KlaviyoObject | null {
  const k = (window as typeof window & { klaviyo?: unknown }).klaviyo;
  if (k && !Array.isArray(k) && typeof (k as KlaviyoObject).track === "function") {
    return k as KlaviyoObject;
  }
  return null;
}

/** Ré-émet `fn` selon RETRY_SCHEDULE_MS — sans jamais awaiter klaviyo. */
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

/** Identifiant stable : dédoublonne ré-émissions client ET rejeu serveur. */
function makeEventId(event: string): string {
  return `${event}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

// ---------- Relais serveur (chemin first-party, insensible aux bloqueurs) ----------

function sendToServer(entry: QueuedEvent, email: string) {
  const body = JSON.stringify({
    event: entry.event,
    properties: entry.properties,
    email,
    uniqueId: entry.uniqueId,
    time: entry.time,
  });
  try {
    // sendBeacon survit à la navigation (fiable même si l'utilisateur quitte la page)
    if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // best effort
  }
}

/** Rejoue vers le serveur les événements que klaviyo.js n'a pas pu livrer. */
function flushQueue(email: string) {
  const queue = loadQueue();
  if (!queue.length) return;
  for (const entry of queue) {
    if (!entry.clientDelivered) sendToServer(entry, email);
  }
  saveQueue([]);
}

// ---------- API publique (signatures stables — utilisées par cart.ts et les pages) ----------

/** Envoie un événement (best effort, jamais bloquant, sans doublon). */
export function track(event: string, properties: Record<string, unknown> = {}) {
  const uniqueId = makeEventId(event);
  const now = new Date().toISOString();
  const email = getStoredEmail();

  if (email) {
    // Identifié : chemin serveur uniquement — fiable même avec bloqueur.
    sendToServer({ event, properties, uniqueId, time: now }, email);
    return;
  }

  // Anonyme : klaviyo.js si possible (cookie anonyme), file locale en parallèle.
  emitWithRetries((klaviyo) => klaviyo.track(event, { ...properties, $event_id: uniqueId }));
  const queue = loadQueue();
  queue.push({ event, properties, uniqueId, time: now });
  saveQueue(queue);

  // Après la dernière tentative : si klaviyo.js a chargé, il a livré l'événement
  // (fiable une fois prêt — prouvé) → ne pas le rejouer côté serveur plus tard.
  setTimeout(
    () => {
      if (getKlaviyo()) markClientDelivered(uniqueId);
    },
    RETRY_SCHEDULE_MS[RETRY_SCHEDULE_MS.length - 1] + 500
  );
}

/** Identifie le profil : mémorise l'email, informe klaviyo.js, rejoue la file. */
export function identify(properties: Record<string, unknown>) {
  const email = String(properties.email ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) return;

  storeEmail(email);
  // klaviyo.js reste utile quand il charge : cookie d'identité, Active on Site, forms.
  emitWithRetries((klaviyo) => klaviyo.identify({ ...properties, email }));
  flushQueue(email);
}

/**
 * À appeler au chargement de chaque page (voir Layout.astro) :
 * - réplique l'auto-identification `?utm_email=` de klaviyo.js, pour qu'elle
 *   fonctionne aussi quand le script est bloqué ;
 * - rejoue une éventuelle file en attente si l'identité est déjà connue
 *   (rattrapage si un précédent envoi a échoué).
 */
export function initKlaviyo() {
  try {
    const utmEmail = new URLSearchParams(window.location.search).get("utm_email");
    if (utmEmail && EMAIL_RE.test(utmEmail.trim())) {
      identify({ email: utmEmail.trim() });
      return;
    }
    const email = getStoredEmail();
    if (email) flushQueue(email);
  } catch {
    // best effort
  }
}
