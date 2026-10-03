import type { Household } from "@/lib/types";
import type { Recipe } from "@/lib/types";

/** Lightweight on-device score (0–100) for demo / judge walkthrough — not a trained model. */
export function scoreRecipeFit(
  household: Household,
  recipe: Recipe,
  memorySnippets: string[],
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 72;

  const allergyHits = household.allergies.filter((a) =>
    recipe.ingredients.some((i) =>
      i.item.toLowerCase().includes(a.toLowerCase()),
    ),
  );
  if (allergyHits.length) {
    score -= 40;
    reasons.push(`Possible allergen overlap: ${allergyHits.join(", ")}`);
  } else if (household.allergies.length) {
    score += 8;
    reasons.push("No obvious allergen overlap with listed ingredients");
  }

  const memoryText = memorySnippets.join(" ").toLowerCase();
  if (/too spicy|less chili|mild/i.test(memoryText)) {
    if (/chili|hot sauce|cayenne/i.test(recipe.summary + recipe.title)) {
      score -= 12;
      reasons.push("Past feedback mentioned milder heat");
    }
  }
  if (/loved|again|favorite/i.test(memoryText)) {
    score += 6;
    reasons.push("Positive memories from prior pots");
  }

  for (const cuisine of household.favoriteCuisines) {
    if (
      recipe.title.toLowerCase().includes(cuisine.toLowerCase()) ||
      recipe.summary.toLowerCase().includes(cuisine.toLowerCase())
    ) {
      score += 5;
      reasons.push(`Matches favorite cuisine: ${cuisine}`);
      break;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (!reasons.length) reasons.push("Balanced default for pantry + profile");
  return { score, reasons };
}
