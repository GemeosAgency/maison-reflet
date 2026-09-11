/**
 * Pré-génère les phrases fixes de Luma (ouverture, indisponibilité, secours,
 * « Bien noté ») en fichiers statiques : zéro crédit ElevenLabs à l'usage.
 * À relancer si la voix ou une phrase change. Usage :
 *   node scripts/luma-voice-static.mjs   (lit ELEVENLABS_API_KEY dans .env)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const KEY = process.env.ELEVENLABS_API_KEY ?? env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY manquante");

// Même voix par langue, même modèle, mêmes réglages que src/lib/luma/voice.ts.
import { register } from "node:module";
register("./lib/ts-resolve-hooks.mjs", import.meta.url);
const { VOICES, VOICE_MODEL: MODEL } = await import("../src/lib/luma/voice.ts");
const SETTINGS = { stability: 0, similarity_boost: 0.8, speed: 1.2 };

// Les phrases dites : l'adresse email ne se lit pas à voix haute, on dit « la Maison ».
const PHRASES = {
  fr: {
    opening: "[warmly] Pour vous, ou pour offrir ?",
    unavailable: "[warmly] Je ne peux pas vous répondre à l'instant. Écrivez à la Maison, elle vous répondra.",
    fallback: "[warmly] Je préfère ne pas me tromper. Écrivez à la Maison, elle vous répondra.",
    emailDone: "[warmly] Bien noté.",
  },
  en: {
    opening: "[warmly] For you, or for someone else?",
    unavailable: "[warmly] I cannot answer you right now. Write to the House, and they will answer you.",
    fallback: "[warmly] I would rather not get this wrong. Write to the House, and they will answer you.",
    emailDone: "[warmly] Noted.",
  },
};

const langOnly = process.argv.includes("--lang") ? process.argv[process.argv.indexOf("--lang") + 1] : null;
for (const [lang, phrases] of Object.entries(PHRASES)) {
  if (langOnly && lang !== langOnly) continue;
  mkdirSync(`public/luma/voice/${lang}`, { recursive: true });
  for (const [key, text] of Object.entries(phrases)) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[lang].voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    });
    if (!res.ok) throw new Error(`${lang}/${key} : HTTP ${res.status} ${await res.text()}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(`public/luma/voice/${lang}/${key}.mp3`, bytes);
    console.log(`ok ${lang}/${key}.mp3 (${Math.round(bytes.length / 1024)} ko, ${text.length} car.)`);
  }
}
