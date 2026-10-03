import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Recipe } from "@/lib/types";
import { hasElevenLabs } from "@/lib/env";

function recipeScript(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .map((i) => `${i.amount} ${i.item}`)
    .join(", ");
  const steps = recipe.steps.map((s, i) => `Step ${i + 1}. ${s}`).join(" ");
  return `${recipe.title}. ${recipe.summary} Ingredients: ${ingredients}. ${steps}`;
}

export async function narrateRecipe(recipe: Recipe): Promise<Buffer> {
  if (!hasElevenLabs()) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";

  const stream = await client.textToSpeech.convert(voiceId, {
    text: recipeScript(recipe),
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  const reader = stream.getReader();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function transcribePantryAudio(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  if (!hasElevenLabs()) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  const modelId =
    process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2";

  const body = await client.speechToText.convert({
    modelId,
    file: {
      data: buffer,
      filename: filename || "pantry.webm",
      contentType: "audio/webm",
    },
    tagAudioEvents: false,
  });
  if ("text" in body && typeof body.text === "string") {
    return body.text.trim();
  }
  if ("transcripts" in body && Array.isArray(body.transcripts)) {
    const first = body.transcripts[0];
    if (first && "text" in first) return String(first.text).trim();
  }
  throw new Error("ElevenLabs STT returned no transcript");
}
