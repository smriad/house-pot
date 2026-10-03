import type { Recipe } from "@/lib/types";
import { findSubstitutes } from "@/lib/serp";

function pantryTokens(pantryText: string): Set<string> {
  return new Set(
    pantryText
      .toLowerCase()
      .split(/[\s,.\n/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2),
  );
}

export function missingFromPantry(
  recipe: Recipe,
  pantryText: string,
): string[] {
  const have = pantryTokens(pantryText);
  const missing: string[] = [];
  for (const ing of recipe.ingredients) {
    const item = ing.item.toLowerCase();
    const words = item.split(/\s+/).filter((w) => w.length > 2);
    const covered = words.some((w) => have.has(w) || pantryText.toLowerCase().includes(w));
    if (!covered) missing.push(ing.item);
  }
  return missing;
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
