import type { Recipe } from "@/lib/types";
import { findSubstitutes } from "@/lib/serp";
import { reviewProposal } from "@/lib/kitchen/pantry-check";

export function missingFromPantry(recipe: Recipe, pantryText: string): string[] {
  return reviewProposal(recipe, pantryText, []).missing;
}

export async function buildShoppingNotes(
  recipe: Recipe,
  pantryText: string,
  allergies: string[],
): Promise<string[]> {
  const missing = missingFromPantry(recipe, pantryText);
  const notes: string[] = [];
  if (missing.length) {
    notes.push(`Pick up: ${missing.join(", ")}`);
  }
  if (missing[0]) {
    const serp = await findSubstitutes(missing[0], allergies);
    notes.push(...serp.map((s) => `SerpApi: ${s}`));
  }
  return notes;
}
