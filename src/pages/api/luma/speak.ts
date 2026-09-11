import type { APIRoute } from "astro";
import { locales, type Locale } from "../../../i18n";
import { logEvent, voiceCharsToday } from "../../../lib/luma/store";
import { SCRIPT_MAX_CHARS, decodeScript, synthesize, verifyScript, voiceEnabled } from "../../../lib/luma/voice";

export const prerender = false;

/**
 * La voix de Luma : synthèse en flux d'un script parlé (audio/mpeg).
 *
 * GET pour qu'un simple <audio src> puisse lire en streaming. La route ne
 * synthétise QUE des scripts signés par /api/luma/chat pour ce visiteur
 * (cookie) et ce jour : impossible de lui faire lire un texte de son choix.
 * Un plafond quotidien de caractères, tous visiteurs, s'ajoute à la limite
 * posée sur la clé ElevenLabs. Chaque synthèse est journalisée (chars, langue)
 * — c'est ce journal qui fait le compteur.
 */

const SESSION_COOKIE = "mr_luma";
const DAILY_CHARS_CAP = Number(import.meta.env.LUMA_VOICE_DAILY_CHARS) || 100_000;

function deny(status: number, why: string) {
  return new Response(why, { status, headers: { "Cache-Control": "no-store" } });
}

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
    const used = await voiceCharsToday();
    if (used + script.length > DAILY_CHARS_CAP) {
      console.error(`[luma/speak] PLAFOND VOIX ATTEINT : ${used} caractères aujourd'hui (cap ${DAILY_CHARS_CAP}).`);
      await logEvent(null, "voice_cap", { used, cap: DAILY_CHARS_CAP });
      return deny(429, "Voix indisponible pour aujourd'hui.");
    }

    const upstream = await synthesize(script, locale);
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("[luma/speak] ElevenLabs a refusé :", upstream.status, detail.slice(0, 300));
      return deny(502, "Synthèse indisponible.");
    }
    // Le journal ne retarde pas le premier octet.
    void logEvent(null, "voice", { chars: script.length, locale });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        // Réécoute sans nouvelle synthèse : le navigateur garde l'audio le temps de la session.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[luma/speak] échec :", error);
    return deny(502, "Synthèse indisponible.");
  }
};
