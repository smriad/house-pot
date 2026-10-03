import { extractRecipeJsonText, gemmaModelName, kitchenChat } from "@/lib/gemma";
import type { FoodFact, Recipe } from "@/lib/types";
import { recipeSchema } from "@/lib/types";
import type { PantryReview } from "@/lib/kitchen/pantry-check";

function notesFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((note) => String(note).trim()).filter(Boolean).slice(0, 4);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function heatFrom(value: unknown): Critique["heat"] {
  const heat = String(value ?? "").toLowerCase();
  if (heat === "mild" || heat === "medium" || heat === "hot") return heat;
  return undefined;
}

export type Critique = {
  notes: string[];
  heat?: string;
  model: string;
  revised: boolean;
  recipe?: Recipe;
};

export async function critiqueRecipe(input: {
  cookName: string;
  allergies: string[];
  dislikes: string[];
  pantryText: string;
  recipe: Recipe;
  review: PantryReview;
  foodFacts: FoodFact[];
}): Promise<Critique> {
  const model = gemmaModelName();
  const mustRevise = input.review.allergyHits.length > 0;
  const raw = await kitchenChat(
    `You are the second model in House Pot, reviewing another model's dinner draft.
The cook is at the stove. Be specific and short.
Respond with one JSON object only: verdict ("keep" or "revise"), notes (1-3 short sentences), heat ("mild", "medium", or "hot"), and recipe.
recipe is null when verdict is keep.
When verdict is revise, recipe is a full replacement: title, summary, servings, ingredients [{item, amount}], steps, allergyWarnings, openSourceRationale.
Never include a listed allergen, a food made from one, or an Open Food Facts allergen tag that matches the household.
Prefer pantry foods. If the draft is already safe and mostly on hand, verdict is keep.`,
    JSON.stringify({
      cook: input.cookName,
      allergies: input.allergies,
      dislikes: input.dislikes,
      pantry: input.pantryText,
      mustRevise,
      allergyHits: input.review.allergyHits,
      missingFromPantry: input.review.missing,
      openFoodFacts: input.foodFacts,
      draft: input.recipe,
    }),
  );

  if (!raw) {
    return { notes: [], model, revised: false };
  }

  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(extractRecipeJsonText(raw)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = null;
  }

  if (!body) {
    const fallback = raw
      .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
      .trim()
      .slice(0, 280);
    return { notes: fallback ? [fallback] : [], model, revised: false };
  }

  const notes = notesFrom(body.notes ?? body.comment);
  const heat = heatFrom(body.heat);
  const verdict = String(body.verdict ?? "").toLowerCase() === "revise" ? "revise" : "keep";
  const wantRewrite = verdict === "revise" || mustRevise;

  let replacement: Recipe | undefined;
  try {
    if (body.recipe && typeof body.recipe === "object") {
      replacement = recipeSchema.parse(body.recipe);
    } else if (verdict === "revise" && body && typeof body === "object" && "title" in body) {
      replacement = recipeSchema.parse(body);
    }
  } catch {
    replacement = undefined;
  }

  if (!wantRewrite || !replacement) {
    return {
      notes: notes.length
        ? notes
        : [
            wantRewrite
              ? "Second model wanted a rewrite, but the replacement recipe did not parse."
              : "Second model kept this draft.",
          ],
      heat,
      model,
      revised: false,
    };
  }

  return {
    notes,
    heat,
    model,
    revised: true,
    recipe: replacement,
  };
}
