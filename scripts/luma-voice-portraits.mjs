/**
 * Génère les portraits audio des Reflets (src/lib/luma/portraits.ts) en
 * fichiers statiques public/luma/voice/{langue}/parfums/{handle}.mp3 — une fois,
 * zéro crédit ensuite. Passe chaque texte aux garde-fous de Luma avant de payer.
 * Usage : node scripts/luma-voice-portraits.mjs [--only handle] [--lang fr]
 */
import { register } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
register("./lib/ts-resolve-hooks.mjs", import.meta.url);

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const KEY = process.env.ELEVENLABS_API_KEY ?? env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY manquante");

const { PORTRAITS } = await import("../src/lib/luma/portraits.ts");
const { checkOutput } = await import("../src/lib/luma/guardrails.ts");
const { VOICES, VOICE_MODEL } = await import("../src/lib/luma/voice.ts");
const SETTINGS = { stability: 0, similarity_boost: 0.8, speed: 1.2 };

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const langOnly = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
const force = args.includes("--force");

let total = 0;
for (const [lang, byHandle] of Object.entries(PORTRAITS)) {
  if (langOnly && lang !== langOnly) continue;
  mkdirSync(`public/luma/voice/${lang}/parfums`, { recursive: true });
  for (const [handle, script] of Object.entries(byHandle)) {
    if (only && handle !== only) continue;
    const plain = script.replace(/\[[^\]]{1,40}\]/g, " ");
    const faults = checkOutput(plain);
    if (faults.length) throw new Error(`${lang}/${handle} : interdit — ${faults.map((f) => `${f.rule} « ${f.match} »`).join(", ")}`);
    const dest = `public/luma/voice/${lang}/parfums/${handle}.mp3`;
    if (existsSync(dest) && !force) { console.log(`— ${lang}/${handle}.mp3 existe (--force pour régénérer)`); continue; }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[lang].voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: script, model_id: VOICE_MODEL, voice_settings: SETTINGS }),
    });
    if (!res.ok) throw new Error(`${lang}/${handle} : HTTP ${res.status} ${await res.text()}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, bytes);
    total += script.length;
    console.log(`ok ${lang}/${handle}.mp3 (${Math.round(bytes.length / 1024)} ko, ${script.length} car.)`);
  }
}
console.log(`${total} caractères synthétisés.`);
