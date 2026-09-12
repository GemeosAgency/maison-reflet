/**
 * Génère « La recommandation du parfumeur » de chaque accord (src/lib/layering.ts,
 * champ `recommendation`) en fichiers statiques
 * public/luma/voice/{langue}/accords/{id}.mp3 — même voix et mêmes réglages que
 * les portraits (scripts/luma-voice-portraits.mjs) : une fois, zéro crédit
 * ensuite. Chaque texte passe les garde-fous de Luma avant de payer.
 * Usage : node scripts/luma-voice-accords.mjs [--only id] [--lang fr] [--force]
 */
import { register } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
register("./lib/ts-resolve-hooks.mjs", import.meta.url);

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const KEY = process.env.ELEVENLABS_API_KEY ?? env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY manquante");

const { LAYERING, stripVoiceTags } = await import("../src/lib/layering.ts");
const { checkOutput } = await import("../src/lib/luma/guardrails.ts");
const { VOICES, VOICE_MODEL } = await import("../src/lib/luma/voice.ts");
const SETTINGS = { stability: 0, similarity_boost: 0.8, speed: 1.2 };

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const langOnly = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
const force = args.includes("--force");
const dry = args.includes("--dry");

let total = 0;
for (const duo of LAYERING) {
  if (only && duo.id !== only) continue;
  for (const [lang, script] of Object.entries(duo.recommendation)) {
    if (langOnly && lang !== langOnly) continue;
    const faults = checkOutput(stripVoiceTags(script));
    if (faults.length) throw new Error(`${lang}/${duo.id} : interdit — ${faults.map((f) => `${f.rule} « ${f.match} »`).join(", ")}`);
    mkdirSync(`public/luma/voice/${lang}/accords`, { recursive: true });
    const dest = `public/luma/voice/${lang}/accords/${duo.id}.mp3`;
    if (existsSync(dest) && !force) { console.log(`— ${lang}/${duo.id}.mp3 existe (--force pour régénérer)`); continue; }
    if (dry) { console.log(`dry ${lang}/${duo.id} (${script.length} car.)`); total += script.length; continue; }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[lang].voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: script, model_id: VOICE_MODEL, voice_settings: SETTINGS }),
    });
    if (!res.ok) throw new Error(`${lang}/${duo.id} : HTTP ${res.status} ${await res.text()}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, bytes);
    total += script.length;
    console.log(`ok ${lang}/${duo.id}.mp3 (${Math.round(bytes.length / 1024)} ko, ${script.length} car.)`);
  }
}
console.log(`${total} caractères ${dry ? "à synthétiser" : "synthétisés"}.`);
