/**
 * La voix de Luma — ElevenLabs, côté serveur uniquement.
 *
 * Décisions de Sandro (11 septembre 2026, à l'oreille, sur nos phrases) :
 * voix « Victoria » (jeune Parisienne, fluide), modèle v3 en réglage créatif
 * (stabilité 0), vitesse 1,2 — le rythme d'une conseillère en boutique, pas
 * d'une narratrice. Les respirations et hésitations font le naturel : Luma
 * écrit elle-même sa version parlée (outil `speak`), avec l'intention entre
 * crochets ([upbeat], [inhales], [curious]…), que v3 interprète.
 *
 * Sécurité : la route /api/luma/speak ne lit que des scripts SIGNÉS par ce
 * serveur (HMAC lié au visiteur et au jour) — un client ne peut pas faire
 * synthétiser son propre texte à nos frais. Plafond quotidien de caractères
 * en plus de la limite posée sur la clé ElevenLabs.
 *
 * Arabe : désactivé tant qu'un natif du Golfe n'a pas validé la voix.
 */

import type { Locale } from "../../i18n";

export const VOICE_MODEL = "eleven_v3";
const VOICE_SETTINGS = { stability: 0, similarity_boost: 0.8, speed: 1.2 };
/**
 * Mode économie (décision de Sandro, 11 septembre 2026, « économiser les
 * crédits ») : à 80 % du plafond du jour, on bascule sur Flash v2.5 — moitié
 * prix, très rapide, sans indications de ton (on les retire du script) —
 * plutôt que de couper la voix.
 */
export const ECONOMY_MODEL = "eleven_flash_v2_5";
const ECONOMY_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 1.15 };
const OUTPUT_FORMAT = "mp3_44100_128";
/** Une note vocale, pas une lecture : la recommandation, une image, la question. L'écran porte le reste. */
export const SCRIPT_MAX_CHARS = 280;

/** Une voix par langue. EN partage la voix FR tant que Sandro n'a pas tranché. */
export const VOICES: Record<Locale, { voiceId: string; enabled: boolean }> = {
  fr: { voiceId: "O31r762Gb3WFygrEOGh0", enabled: true }, // Victoria
  en: { voiceId: "O31r762Gb3WFygrEOGh0", enabled: true }, // Victoria, en attendant
  ar: { voiceId: "O31r762Gb3WFygrEOGh0", enabled: false }, // après validation par un natif
};

function env(name: string): string | undefined {
  return (
    (typeof process !== "undefined" ? process.env[name] : undefined) ??
    (import.meta.env as Record<string, string | undefined> | undefined)?.[name]
  );
}

export function voiceEnabled(locale: Locale): boolean {
  return Boolean(env("ELEVENLABS_API_KEY")) && VOICES[locale].enabled;
}

/** Le script sans ses indications entre crochets : c'est ce que les garde-fous lisent. */
export function stripTags(script: string): string {
  return script.replace(/\[[^\]]{1,40}\]/g, " ").replace(/\s{2,}/g, " ").trim();
}

/* ------------------------------------------------------------ signature */

const encoder = new TextEncoder();

function secret(): string {
  const s = env("LUMA_VOICE_SECRET") ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (!s) throw new Error("LUMA_VOICE_SECRET ou SUPABASE_SERVICE_ROLE_KEY manquante : impossible de signer les scripts.");
  return s;
}

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export const encodeScript = (script: string) => base64url(encoder.encode(script));
export const decodeScript = (s: string) => new TextDecoder().decode(fromBase64url(s));

/** Jour UTC : un jeton vaut aujourd'hui et hier, pour réécouter une réponse de la veille au soir. */
export function dayStamp(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function hmac(input: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return base64url(new Uint8Array(sig));
}

/** Jeton lié au script, au visiteur (cookie) et au jour. */
export function signScript(script: string, anonId: string, day = dayStamp()): Promise<string> {
  return hmac(`${day}|${anonId}|${script}`);
}

export async function verifyScript(script: string, anonId: string, token: string): Promise<boolean> {
  for (const day of [dayStamp(), dayStamp(-1)]) {
    if ((await signScript(script, anonId, day)) === token) return true;
  }
  return false;
}

/* ------------------------------------------------------------- synthèse */

/**
 * Lance la synthèse en flux et renvoie la réponse ElevenLabs telle quelle
 * (audio/mpeg), à transmettre au navigateur sans attendre la fin.
 */
export async function synthesize(script: string, locale: Locale, economy = false): Promise<Response> {
  const apiKey = env("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY manquante.");
  const { voiceId } = VOICES[locale];
  // Flash ne connaît pas les indications entre crochets : il les lirait à voix haute.
  const body = economy
    ? { text: stripTags(script), model_id: ECONOMY_MODEL, voice_settings: ECONOMY_SETTINGS, language_code: locale }
    : { text: script, model_id: VOICE_MODEL, voice_settings: VOICE_SETTINGS };
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------- cache audio par empreinte */

/**
 * Ne jamais payer deux fois : chaque audio est gardé dans le bucket public
 * `luma-voice` de Supabase Storage, sous l'empreinte de son script et de sa
 * langue. Réécoute, nouvel onglet, retour le lendemain : gratuits. Le contenu
 * est une réponse de Luma, rien de personnel ; l'URL n'est pas devinable.
 */
const BUCKET = "luma-voice";

export async function scriptHash(script: string, locale: Locale): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${locale}|${script}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function storage(): { url: string; key: string } | null {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? { url, key } : null;
}

/** L'audio déjà synthétisé pour cette empreinte, ou null. */
export async function fetchCachedAudio(hash: string): Promise<Response | null> {
  const s = storage();
  if (!s) return null;
  try {
    const res = await fetch(`${s.url}/storage/v1/object/public/${BUCKET}/${hash}.mp3`);
    return res.ok && res.body ? res : null;
  } catch {
    return null;
  }
}

/** Range l'audio pour la prochaine fois. Best effort : un échec ne prive personne de la voix. */
export async function storeAudio(hash: string, bytes: ArrayBuffer): Promise<boolean> {
  const s = storage();
  if (!s) return false;
  try {
    const res = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${hash}.mp3`, {
      method: "POST",
      headers: { apikey: s.key, Authorization: `Bearer ${s.key}`, "Content-Type": "audio/mpeg", "x-upsert": "true" },
      body: bytes,
    });
    if (!res.ok) console.error("[luma/voice] cache audio refusé :", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return res.ok;
  } catch (error) {
    console.error("[luma/voice] cache audio injoignable :", error);
    return false;
  }
}
