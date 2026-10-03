import { extractRecipeJsonText, kitchenChat } from "@/lib/gemma";
import type { Recipe } from "@/lib/types";

/** One-line LLM summary for the cook (free — same GEMMA endpoint as propose). */
export async function buildCookBrief(input: {
  cookName: string;
  recipe: Recipe;
  preferenceScore?: number;
  revised: boolean;
}): Promise<string | null> {
  const raw = await kitchenChat(
    `You are House Pot. Reply with one JSON object: { "brief": "one warm sentence for the cook at the stove" }.
No markdown. Mention the dish name. If revised is true, note the safety pass fixed the draft.`,
    JSON.stringify({
      cook: input.cookName,
      title: input.recipe.title,
      score: input.preferenceScore,
      revised: input.revised,
      servings: input.recipe.servings,
    }),
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(extractRecipeJsonText(raw)) as { brief?: string };
    const brief = parsed.brief?.trim();
    return brief || null;
  } catch {
    return null;
  }
}
