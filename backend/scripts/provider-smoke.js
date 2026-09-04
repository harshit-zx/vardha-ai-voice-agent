#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { generateLlmText } = require("../src/services/llm.service");
const { transcribeAudio } = require("../src/services/stt.service");
const { pcmSampleRateFromFormat, synthesizeSpeech } = require("../src/services/tts.service");

const args = process.argv.slice(2);
const selected = new Set(args.filter((value) => !value.startsWith("--sample-rate=")));
const runAll = !selected.size || selected.has("--all");
const shouldRun = (flag) => runAll || selected.has(flag);
const audioPath = args.find((value) => !value.startsWith("--"));
const sampleRateArg = args.find((value) => value.startsWith("--sample-rate="));
const sampleRate = Number(sampleRateArg?.split("=", 2)[1] || 8000);

async function checkGemini() {
  const text = await generateLlmText({
    systemPrompt: "Reply with a concise provider connectivity confirmation.",
    messages: [{ role: "user", content: "Confirm Gemini is responding." }],
  });
  console.log(`[SMOKE] Gemini returned: ${text.slice(0, 120)}`);
}

async function checkElevenLabs() {
  const pcm = await synthesizeSpeech("This is a Vardha AI provider test.", { outputSampleRate: pcmSampleRateFromFormat(process.env.TTS_OUTPUT_FORMAT) });
  console.log(`[SMOKE] ElevenLabs returned ${pcm.length} PCM bytes.`);
  return pcm;
}

async function checkGroq(pcm, rate) {
  const text = await transcribeAudio(pcm, { sampleRate: rate });
  console.log(`[SMOKE] Groq Whisper transcribed: ${text || "(empty transcript)"}`);
}

async function main() {
  if (shouldRun("--gemini")) await checkGemini();

  let ttsPcm;
  if (shouldRun("--elevenlabs")) ttsPcm = await checkElevenLabs();

  if (shouldRun("--groq")) {
    if (!audioPath) {
      throw new Error("Groq smoke test requires raw signed 16-bit little-endian PCM: npm run test:providers -- --groq path/to/audio.pcm --sample-rate=8000");
    }
    const resolvedPath = path.resolve(process.cwd(), audioPath);
    await checkGroq(fs.readFileSync(resolvedPath), sampleRate);
  }

  if (selected.has("--groq-from-elevenlabs")) {
    const pcm = ttsPcm || await checkElevenLabs();
    await checkGroq(pcm, pcmSampleRateFromFormat(process.env.TTS_OUTPUT_FORMAT));
  }
}

main().catch((error) => {
  console.error("[SMOKE] Provider check failed:", error.response?.status || error.message);
  process.exitCode = 1;
});
