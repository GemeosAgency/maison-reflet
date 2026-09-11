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
const OUTPUT_FORMAT = "mp3_44100_128";
export const SCRIPT_MAX_CHARS = 700;

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
export async function synthesize(script: string, locale: Locale): Promise<Response> {
  const apiKey = env("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY manquante.");
  const { voiceId } = VOICES[locale];
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: script, model_id: VOICE_MODEL, voice_settings: VOICE_SETTINGS }),
  });
}
