import OpenAI from "openai";
import { recipeSchema, type Recipe } from "@/lib/types";

const DEFAULT_OLLAMA = "http://127.0.0.1:11434/v1";

export function resolveGemmaBaseUrl(): string {
  return process.env.GEMMA_BASE_URL?.trim() || DEFAULT_OLLAMA;
}

export function isGemmaConfigured(): boolean {
  return Boolean(process.env.GEMMA_BASE_URL?.trim());
}

/** Gemma 4 / Gemini may prefix reasoning in <thought> blocks before JSON. */
export function extractRecipeJsonText(raw: string): string {
  let text = raw.trim();
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function client(): OpenAI {
  return new OpenAI({
    baseURL: resolveGemmaBaseUrl(),
    apiKey: process.env.GEMMA_API_KEY?.trim() || "ollama",
  });
}

export async function probeGemma(): Promise<boolean> {
  const openai = client();
  const model = process.env.GEMMA_MODEL?.trim() || "gemma3:4b";
  try {
    await openai.models.retrieve(model);
    return true;
  } catch {
    try {
      await openai.chat.completions.create({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ok" }],
      });
      return true;
    } catch {
      return false;
    }
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
  publicRecipeIdeas?: string[];
}): Promise<Recipe> {
  const reachable = await probeGemma();
  if (!reachable && !isGemmaConfigured()) {
    return demoRecipe(params);
  }

  const model = process.env.GEMMA_MODEL?.trim() || "gemma3:4b";
  const openai = client();

  const system = `You are House Pot, a kitchen agent for one household cook.
Prefer ingredients named in the pantry. You may list something missing, but never include a listed allergen or a food made from one, including substitutes.
Respond with a single JSON object only — no markdown fences, no <thought> tags, no prose before or after.
Match schema fields: title, summary, servings, ingredients (item, amount, optional substitute), steps, allergyWarnings, openSourceRationale.
allergyWarnings lists allergens you considered and then left out.
openSourceRationale must say this recipe was planned with ${model}. Do not name any other model family.
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
      publicRecipeIdeas: params.publicRecipeIdeas ?? [],
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

      const parsed = recipeSchema.parse(JSON.parse(extractRecipeJsonText(raw)));
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

export function gemmaModelName(): string {
  return process.env.GEMMA_MODEL?.trim() || "gemma3:4b";
}

/** Second-pass chat. Returns null when the endpoint is down so the cook still gets the first draft. */
export async function kitchenChat(system: string, user: string): Promise<string | null> {
  const model = gemmaModelName();
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  try {
    const completion = await client().chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch {
    try {
      const completion = await client().chat.completions.create({
        model,
        temperature: 0.2,
        messages,
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }
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
  const fromPantry = params.pantryText
    .split(/[,.\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
    .slice(0, 6);
  return {
    title: "Weeknight dal with whatever is in the pot",
    summary: `A forgiving lentil stew for ${params.cookName} and ${params.diners} diners, built from what's on hand.${safe}`,
    servings: params.diners,
    ingredients: (fromPantry.length ? fromPantry : ["lentils"]).map((item) => ({
      item,
      amount: "from the pantry",
    })),
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
