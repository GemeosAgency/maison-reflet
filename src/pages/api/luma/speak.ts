import type { APIRoute } from "astro";
import { locales, type Locale } from "../../../i18n";
import { logEvent, voiceCharsToday } from "../../../lib/luma/store";
import {
  ECONOMY_MODEL,
  SCRIPT_MAX_CHARS,
  VOICE_MODEL,
  decodeScript,
  fetchCachedAudio,
  scriptHash,
  storeAudio,
  synthesize,
  verifyScript,
  voiceEnabled,
} from "../../../lib/luma/voice";

export const prerender = false;

/**
 * La voix de Luma : l'audio d'un script parlé (audio/mpeg).
 *
 * GET pour qu'un simple <audio src> puisse le lire. La route ne synthétise QUE
 * des scripts signés par /api/luma/chat pour ce visiteur (cookie) et ce jour :
 * impossible de lui faire lire un texte de son choix.
 *
 * Économie de crédits (Sandro, 11 septembre 2026) :
 *  1. le cache d'abord — un script déjà synthétisé (même langue) est servi
 *     depuis Supabase Storage, sans toucher ElevenLabs ;
 *  2. un plafond quotidien de caractères, tous visiteurs ; à 80 %, bascule
 *     sur le modèle économique plutôt que de couper ;
 *  3. l'audio est gardé pour la prochaine fois. On attend la synthèse
 *     complète (scripts courts, ~3-5 s) plutôt que de la relayer en flux :
 *     c'est ce qui permet de la ranger de façon fiable.
 * Chaque synthèse est journalisée (chars, langue, modèle) : c'est le compteur.
 */

const SESSION_COOKIE = "mr_luma";
const DAILY_CHARS_CAP = Number(import.meta.env.LUMA_VOICE_DAILY_CHARS) || 100_000;
const ECONOMY_FROM = 0.8;

function deny(status: number, why: string) {
  return new Response(why, { status, headers: { "Cache-Control": "no-store" } });
}
const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  // Le contenu ne change jamais pour une empreinte donnée : le navigateur peut le garder longtemps.
  "Cache-Control": "private, max-age=2592000, immutable",
  "X-Content-Type-Options": "nosniff",
};

export const GET: APIRoute = async ({ cookies, url }) => {
  const anonId = cookies.get(SESSION_COOKIE)?.value;
  if (!anonId) return deny(403, "Pas de conversation en cours.");

  const l = (url.searchParams.get("l") ?? "").toLowerCase();
  const locale: Locale | null = (locales as readonly string[]).includes(l) ? (l as Locale) : null;
  if (!locale || !voiceEnabled(locale)) return deny(404, "Voix indisponible pour cette langue.");

  let script = "";
  try {
    script = decodeScript(url.searchParams.get("s") ?? "");
  } catch {
    return deny(400, "Script illisible.");
  }
  const token = url.searchParams.get("t") ?? "";
  if (!script || script.length > SCRIPT_MAX_CHARS || !token) return deny(400, "Script invalide.");
  if (!(await verifyScript(script, anonId, token))) return deny(403, "Script non signé pour ce visiteur.");

  try {
    const hash = await scriptHash(script, locale);
    const cached = await fetchCachedAudio(hash);
    if (cached) return new Response(cached.body, { status: 200, headers: { ...AUDIO_HEADERS, "X-Luma-Voice": "cache" } });

    const used = await voiceCharsToday();
    if (used + script.length > DAILY_CHARS_CAP) {
      console.error(`[luma/speak] PLAFOND VOIX ATTEINT : ${used} caractères aujourd'hui (cap ${DAILY_CHARS_CAP}).`);
      await logEvent(null, "voice_cap", { used, cap: DAILY_CHARS_CAP });
      return deny(429, "Voix indisponible pour aujourd'hui.");
    }
    const economy = used > DAILY_CHARS_CAP * ECONOMY_FROM;

    const upstream = await synthesize(script, locale, economy);
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[luma/speak] ElevenLabs a refusé :", upstream.status, detail.slice(0, 300));
      return deny(502, "Synthèse indisponible.");
    }
    const bytes = await upstream.arrayBuffer();
    // Journal et cache en parallèle ; ni l'un ni l'autre ne retient l'audio.
    void Promise.all([
      logEvent(null, "voice", { chars: script.length, locale, model: economy ? ECONOMY_MODEL : VOICE_MODEL, bytes: bytes.byteLength }),
      storeAudio(hash, bytes),
    ]);
    return new Response(bytes, { status: 200, headers: { ...AUDIO_HEADERS, "X-Luma-Voice": economy ? "economy" : "v3" } });
  } catch (error) {
    console.error("[luma/speak] échec :", error);
    return deny(502, "Synthèse indisponible.");
  }
};
