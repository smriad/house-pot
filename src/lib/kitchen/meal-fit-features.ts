import type { Household, Recipe } from "@/lib/types";

export type MealFitFeatures = {
  diners: number;
  allergy_count: number;
  pantry_token_count: number;
  step_count: number;
  spicy_flag: number;
  memory_positive: number;
};

export function buildMealFitFeatures(
  household: Household,
  recipe: Recipe,
  memorySnippets: string[],
): MealFitFeatures {
  const memoryText = memorySnippets.join(" ").toLowerCase();
  return {
    diners: recipe.servings,
    allergy_count: household.allergies.length,
    pantry_token_count: recipe.ingredients.length,
    step_count: recipe.steps.length,
    spicy_flag: /chili|spicy|cayenne|hot sauce/i.test(
      `${recipe.title} ${recipe.summary}`,
    )
      ? 1
      : 0,
    memory_positive: /loved|again|favorite|perfect/i.test(memoryText) ? 1 : 0,
  };
}

/** Rough label for feedback → training rows (not ground truth). */
export function feedbackSentimentLabel(feedback: string): number {
  const t = feedback.toLowerCase();
  if (/bad|hate|wrong|never|awful|too spicy|disaster/.test(t)) return 0;
  if (/loved|perfect|great|good|right|delicious|yes/.test(t)) return 1;
  if (/\bagain\b/.test(t) && !/never\s+again/.test(t)) return 1;
  return 0.5;
}
