import { cosineSimilarity, embedText } from "@/lib/embeddings";
import { allergyConflict } from "@/lib/kitchen/pantry-check";

const SIMILARITY_THRESHOLD = 0.72;

/**
 * Embedding-based near-miss hints only — never used to block approve (policy stays in pantry-check).
 */
export async function semanticAllergenHints(
  ingredientItems: string[],
  allergies: string[],
): Promise<string[]> {
  if (!allergies.length || ingredientItems.length === 0) return [];

  const hints: string[] = [];
  const allergyEmbeds = new Map<string, number[] | null>();
  for (const allergy of allergies) {
    allergyEmbeds.set(allergy, await embedText(allergy));
  }

  for (const item of ingredientItems.slice(0, 10)) {
    if (allergyConflict(item, allergies)) continue;
    const itemEmbed = await embedText(item);
    if (!itemEmbed) continue;
    for (const allergy of allergies) {
      const allergyEmbed = allergyEmbeds.get(allergy);
      if (!allergyEmbed) continue;
      const sim = cosineSimilarity(itemEmbed, allergyEmbed);
      if (sim >= SIMILARITY_THRESHOLD) {
        hints.push(
          `Verify "${item}" — embedding similarity to ${allergy} (${sim.toFixed(2)}); code did not flag it.`,
        );
      }
    }
  }

  return [...new Set(hints)].slice(0, 4);
}
