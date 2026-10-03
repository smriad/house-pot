import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { loadEnvLocal, mediaDurationSec } from "./demo-env.mjs";

/** Male English, South Asian cadence (Aashish — closest premade to Bangladesh kitchen demos). */
export const DEFAULT_DEMO_VOICE_ID = "RpiHVNPKGBg7UmgmrKrN";

/**
 * Demo narration: which technology, where in the stack, how it is used.
 * Edit `text`, then `DEMO_REUSE_VOICE=0 npm run demo:record`.
 */
export const TOUR_CHAPTERS = [
  {
    id: "nextjs",
    text:
      "Technology: Next.js sixteen with React nineteen. Where: this browser UI is House Pot App, and the App Router hosts API routes under slash api. How used: the cook interacts here; every button calls JSON APIs that delegate to orchestrator dot TypeScript on the server. Hosting on Render serves this same build from render dot yaml.",
  },
  {
    id: "health",
    text:
      "Technology: integration health probes. Where: the status strip under the header, backed by GET slash api slash health. How used: before you demo, confirm Gemma, MongoDB, and ElevenLabs show live; optional flags cover Temporal, embeddings, SerpApi, and Mastra when configured.",
  },
  {
    id: "mongodb_profile",
    text:
      "Technology: MongoDB Atlas. Where: household documents in the house underscore pot database, via store dot TypeScript with a local JSON fallback. How used: cook name, allergies, dislikes, and diners post to slash api slash household; that id is saved in the browser and loaded on every propose.",
  },
  {
    id: "input_stt",
    text:
      "Technology: pantry input—browser Web Speech, optional OpenAI Whisper, or ElevenLabs Scribe. Where: the pantry textarea and the record or speech buttons on the left column. How used: text becomes pantry input on POST slash api slash runs; voice is transcribed only for planning—ElevenLabs text to speech never receives the raw recording.",
  },
  {
    id: "gemma",
    text:
      "Technology: Gemma through an OpenAI-compatible client in gemma dot TypeScript. Where: server-side in kitchen orchestrator after POST slash api slash runs. How used: one JSON recipe from pantry plus allergies; optional critic pass and cook brief; Open Food Facts and TheMealDB may enrich context before the card renders.",
  },
  {
    id: "policy",
    text:
      "Technology: deterministic TypeScript in pantry-check dot TypeScript—not the LLM. Where: marks on this recipe card and the can-approve gate in the UI. How used: each ingredient is in-kitchen or missing; allergen rules block approve and narrate; approve and narrate routes re-run the same review so safety stays in code.",
  },
  {
    id: "elevenlabs",
    text:
      "Technology: ElevenLabs text to speech. Where: slash api slash runs slash id slash narrate and slash approve with auto-narrate, implemented in elevenlabs dot TypeScript. How used: only after the cook taps Approve and read aloud; the model reads approved title, ingredients, and steps—never the pantry voice note.",
  },
  {
    id: "mongodb_runs",
    text:
      "Technology: MongoDB again for run history. Where: Pot history page and the recent pots dropdown, plus POST slash api slash runs slash id slash feedback. How used: every propose stores a KitchenRun with trace steps; feedback like less cumin updates pantry memory for the next night.",
  },
  {
    id: "recipe",
    text:
      "Technology: ElevenLabs again on the approved recipe payload. Where: the audio player on this card after narrate completes. How used: listen for the full dish; judges can also fetch trace JSON at slash api slash runs slash id slash trace for the agent steps.",
  },
];

export function demoVoiceId() {
  return (
    process.env.DEMO_ELEVENLABS_VOICE_ID?.trim() ||
    process.env.ELEVENLABS_DEMO_VOICE_ID?.trim() ||
    DEFAULT_DEMO_VOICE_ID
  );
}

export function demoAudioGain() {
  const n = parseFloat(process.env.DEMO_AUDIO_GAIN ?? "1.6");
  return Number.isFinite(n) && n > 0 ? n : 1.6;
}

/** Per-clip leveling so tour chapters and recipe narration match before mixing. */
function segmentAudioFilter(inputRef, outputLabel) {
  const g = demoAudioGain();
  return `[${inputRef}]dynaudnorm=f=251:g=23:p=0.95,volume=${g},alimiter=limit=0.98:attack=2:release=50[${outputLabel}]`;
}

/** Final pass on the muxed track (evens quiet tour vs loud recipe half). */
function masterAudioFilter(inputRef, outputLabel) {
  return `[${inputRef}]dynaudnorm=f=901:g=21:p=0.95,alimiter=limit=0.98:attack=2:release=50[${outputLabel}]`;
}

function voiceSettings() {
  return {
    stability: 0.4,
    similarityBoost: 0.85,
    style: 0.2,
    useSpeakerBoost: true,
  };
}

export function recipeScript(recipe) {
  const ingredients = recipe.ingredients
    .map((i) => `${i.amount} ${i.item}`)
    .join(", ");
  const steps = recipe.steps.map((s, i) => `Step ${i + 1}. ${s}`).join(" ");
  return `${recipe.title}. ${recipe.summary} Ingredients: ${ingredients}. ${steps}`;
}

export async function synthesizeText(client, voiceId, text, dest) {
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
    voiceSettings: voiceSettings(),
  });
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  fs.writeFileSync(dest, Buffer.concat(chunks));
}

export async function synthesizeRecipeNarration(recipe, dest) {
  loadEnvLocal();
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const client = new ElevenLabsClient({ apiKey: key });
  await synthesizeText(client, demoVoiceId(), recipeScript(recipe), dest);
}

export async function synthesizeTourVoices(outDir) {
  loadEnvLocal();
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY missing — add to .env.local for tour voiceover");
  }
  fs.mkdirSync(outDir, { recursive: true });
  const client = new ElevenLabsClient({ apiKey: key });
  const voiceId = demoVoiceId();
  console.log("Demo voice id:", voiceId);

  const files = {};
  for (const chapter of TOUR_CHAPTERS) {
    const dest = path.join(outDir, `${chapter.id}.mp3`);
    if (fs.existsSync(dest) && process.env.DEMO_REUSE_VOICE !== "0") {
      files[chapter.id] = dest;
      continue;
    }
    console.log("Voice:", chapter.id);
    await synthesizeText(client, voiceId, chapter.text, dest);
    files[chapter.id] = dest;
  }
  return files;
}

/**
 * @param {{ atSec: number, path: string }[]} timeline
 * @param {number} totalSec
 */
export function buildTourAudioTrack(timeline, totalSec, outPath) {
  const inputs = [];
  const filters = [];
  timeline.forEach((seg, i) => {
    inputs.push("-i", seg.path);
    const delayMs = Math.max(0, Math.round(seg.atSec * 1000));
    const pre = `pre${i}`;
    filters.push(segmentAudioFilter(`${i}:a`, pre));
    filters.push(`[${pre}]adelay=${delayMs}|${delayMs}[a${i}]`);
  });
  const mixInputs = timeline.map((_, i) => `[a${i}]`).join("");
  const filter = `${filters.join(";")};${mixInputs}amix=inputs=${timeline.length}:duration=longest:dropout_transition=0:normalize=0[outa];${masterAudioFilter("outa", "final")}`;

  execFileSync(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[final]",
      "-t",
      String(Math.ceil(totalSec + 1)),
      "-c:a",
      "libmp3lame",
      "-q:a",
      "2",
      outPath,
    ],
    { stdio: "inherit" },
  );
}

export function mergeVideoAndAudio(videoPath, audioPath, destPath) {
  const videoSec = mediaDurationSec(videoPath);
  const audioSec = mediaDurationSec(audioPath);
  const padSec = Math.max(0, audioSec - videoSec + 0.25);

  const audioMap = masterAudioFilter("1:a", "aout");

  if (padSec > 0.15) {
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-filter_complex",
        `[0:v]tpad=stop_mode=clone:stop_duration=${padSec.toFixed(3)}[v];${audioMap}`,
        "-map",
        "[v]",
        "-map",
        "[aout]",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        destPath,
      ],
      { stdio: "inherit" },
    );
    return;
  }

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-filter_complex",
      audioMap,
      "-map",
      "0:v:0",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      destPath,
    ],
    { stdio: "inherit" },
  );
}
