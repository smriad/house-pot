import { proposeRecipe } from "@/lib/gemma";
import { scoreRecipeFit } from "@/lib/kitchen/preference-score";
import { reviewProposal } from "@/lib/kitchen/pantry-check";
import { predictMealFit } from "@/lib/tabpfn/predict";
import type { Household, Recipe } from "@/lib/types";

const STYLE_HINTS = [
  "mild quick weeknight",
  "classic comfort from the pantry",
  "use every listed pantry ingredient",
];

export function proposeCandidateCount(): number {
  const n = Number.parseInt(process.env.PROPOSE_CANDIDATES ?? "1", 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, n));
}

export type ProposeContext = {
  household: Household;
  pantryText: string;
  voiceTranscript?: string;
  diners: number;
  memorySnippets: string[];
  substituteHints: string[];
  serpInspiration?: string[];
  publicRecipeIdeas?: string[];
};

export async function proposeWithRanking(
  ctx: ProposeContext,
): Promise<{ recipe: Recipe; alternateTitles: string[] }> {
  const n = proposeCandidateCount();
  const base = {
    cookName: ctx.household.cookName,
    allergies: ctx.household.allergies,
    dislikes: ctx.household.dislikes,
    cuisines: ctx.household.favoriteCuisines,
    pantryText: ctx.pantryText,
    voiceTranscript: ctx.voiceTranscript,
    diners: ctx.diners,
    memorySnippets: ctx.memorySnippets,
    substituteHints: ctx.substituteHints,
    serpInspiration: ctx.serpInspiration,
    publicRecipeIdeas: ctx.publicRecipeIdeas,
  };

  if (n === 1) {
    const recipe = await proposeRecipe({
      ...base,
      styleHint: STYLE_HINTS[0],
    });
    return { recipe, alternateTitles: [] };
  }

  type Scored = { recipe: Recipe; score: number };
  const scored: Scored[] = [];

  for (let i = 0; i < n; i++) {
    const recipe = await proposeRecipe({
      ...base,
      styleHint: STYLE_HINTS[i] ?? STYLE_HINTS[0],
    });
    const review = reviewProposal(
      recipe,
      ctx.pantryText,
      ctx.household.allergies,
    );
    const fit = scoreRecipeFit(ctx.household, recipe, ctx.memorySnippets);
    const tabpfn = await predictMealFit(
      ctx.household,
      recipe,
      ctx.memorySnippets,
    );
    let score = (fit.score + tabpfn.score) / 2;
    if (review.safeToNarrate) score += 25;
    score -= review.missing.length * 3;
    scored.push({ recipe, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0]!;
  const alternateTitles = scored.slice(1).map((s) => s.recipe.title);
  return { recipe: winner.recipe, alternateTitles };
}
