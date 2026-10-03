import OpenAI from "openai";
import { recipeSchema, type Recipe } from "@/lib/types";

const DEFAULT_OLLAMA = "http://127.0.0.1:11434/v1";

export function resolveGemmaBaseUrl(): string {
  return process.env.GEMMA_BASE_URL?.trim() || DEFAULT_OLLAMA;
}

export function isGemmaConfigured(): boolean {
  return Boolean(process.env.GEMMA_BASE_URL?.trim());
}

function client(): OpenAI {
  return new OpenAI({
    baseURL: resolveGemmaBaseUrl(),
    apiKey: process.env.GEMMA_API_KEY?.trim() || "ollama",
  });
}

export async function probeGemma(): Promise<boolean> {
  try {
    const openai = client();
    await openai.models.list();
    return true;
  } catch {
    return false;
  }
}

export async function proposeRecipe(params: {
  cookName: string;
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  pantryText: string;
  voiceTranscript?: string;
  diners: number;
  memorySnippets: string[];
  substituteHints: string[];
  serpInspiration?: string[];
}): Promise<Recipe> {
  const reachable = await probeGemma();
  if (!reachable && !isGemmaConfigured()) {
    return demoRecipe(params);
  }

  const model = process.env.GEMMA_MODEL?.trim() || "gemma3:4b";
  const openai = client();

  const system = `You are House Pot, a kitchen agent for one household cook.
Use only the pantry and constraints given. Never suggest ingredients that conflict with listed allergies.
Respond with JSON only, matching the recipe schema fields: title, summary, servings, ingredients (item, amount, optional substitute), steps, allergyWarnings, openSourceRationale.
openSourceRationale must explain why a local open-weight model is appropriate (privacy, offline, no vendor lock-in).`;

  const user = JSON.stringify(
    {
      cookName: params.cookName,
      allergies: params.allergies,
      dislikes: params.dislikes,
      favoriteCuisines: params.cuisines,
      pantry: params.pantryText,
      voiceTranscript: params.voiceTranscript,
      diners: params.diners,
      pastPantryMemories: params.memorySnippets,
      substituteResearch: params.substituteHints,
      serpMealIdeas: params.serpInspiration ?? [],
    },
    null,
    2,
  );

  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Gemma returned an empty response");

      const parsed = recipeSchema.parse(JSON.parse(raw));
      if (!parsed.openSourceRationale) {
        parsed.openSourceRationale =
          `Recipe planned with open-weight ${model} in ${Date.now() - started}ms; pantry constraints stayed on our inference endpoint.`;
      }
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemma request failed");
}

function demoRecipe(params: {
  cookName: string;
  allergies: string[];
  pantryText: string;
  diners: number;
}): Recipe {
  const safe = params.allergies.length
    ? ` Avoiding: ${params.allergies.join(", ")}.`
    : "";
  return {
    title: "Weeknight dal with whatever is in the pot",
    summary: `A forgiving lentil stew for ${params.cookName} and ${params.diners} diners, built from what's on hand.${safe}`,
    servings: params.diners,
    ingredients: [
      { item: "red lentils", amount: "1 cup" },
      { item: "onion", amount: "1 medium" },
      { item: "garlic", amount: "3 cloves" },
      { item: "cumin", amount: "1 tsp" },
      {
        item: "pantry vegetables",
        amount: "2 cups chopped",
        substitute: params.pantryText.slice(0, 80),
      },
    ],
    steps: [
      "Rinse lentils until the water runs clear.",
      "Sauté onion and garlic with cumin until fragrant.",
      "Add lentils, chopped pantry veg, and enough water to cover by two fingers.",
      "Simmer 25 minutes, stirring occasionally, until creamy.",
      "Taste and adjust salt; serve with rice or flatbread.",
    ],
    allergyWarnings: params.allergies,
    openSourceRationale:
      "Demo mode: start Ollama (ollama pull gemma3:4b) or set GEMMA_BASE_URL to your open-weight endpoint.",
  };
}
