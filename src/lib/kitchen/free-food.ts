import { allergyConflict } from "@/lib/kitchen/pantry-check";
import type { FoodFact } from "@/lib/types";

const USER_AGENT = "HousePot/1.0 (hacktoberfest; household kitchen)";

const SKIP = new Set([
  "and",
  "the",
  "with",
  "some",
  "have",
  "from",
  "salt",
  "water",
  "oil",
  "pepper",
]);

/** Open Food Facts allergen tags mapped onto House Pot allergy words. */
const TAG_LABEL: Record<string, string> = {
  "en:peanuts": "peanut",
  "en:milk": "dairy",
  "en:gluten": "gluten",
  "en:eggs": "egg",
  "en:soybeans": "soy",
  "en:fish": "fish",
  "en:crustaceans": "shellfish",
  "en:molluscs": "shellfish",
  "en:sesame-seeds": "sesame",
  "en:nuts": "almond",
  "en:celery": "celery",
  "en:mustard": "mustard",
  "en:lupin": "lupin",
  "en:sulphur-dioxide-and-sulphites": "sulfite",
};

export type HiddenAllergen = {
  item: string;
  allergy: string;
  tag: string;
};

export type FreeFoodProbe = {
  meals: boolean;
  facts: boolean;
};

function pantryQueries(pantryText: string): string[] {
  const words = pantryText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3 && !SKIP.has(word));
  return [...new Set(words)].slice(0, 2);
}

async function getJson(url: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return await res.json();
      if (res.status < 500 && res.status !== 429) return null;
    } catch {
      // retry once on a dropped connection
    }
  }
  return null;
}

/** TheMealDB's public test key. No account. Real dish names for the planner. */
export async function fetchMealIdeas(pantryText: string): Promise<string[]> {
  const queries = pantryQueries(pantryText);
  const titles: string[] = [];
  for (const query of queries) {
    const filtered = (await getJson(
      `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(query)}`,
    )) as { meals?: Array<{ strMeal?: string }> | null } | null;
    const fromFilter = filtered?.meals?.map((meal) => meal.strMeal?.trim()).filter(Boolean) ?? [];
    if (fromFilter.length) {
      titles.push(...(fromFilter as string[]));
      continue;
    }
    const searched = (await getJson(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
    )) as { meals?: Array<{ strMeal?: string }> | null } | null;
    titles.push(
      ...((searched?.meals?.map((meal) => meal.strMeal?.trim()).filter(Boolean) as string[]) ?? []),
    );
  }
  return [...new Set(titles)].slice(0, 4);
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}

/** The search hit has to actually be the ingredient, not a product that merely ranked first. */
export function productMatchesItem(item: string, productName?: string): boolean {
  if (!productName) return false;
  const wanted = words(item);
  const found = words(productName);
  return wanted.some((word) =>
    found.some(
      (have) => word === have || word + "s" === have || have + "s" === word,
    ),
  );
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

/** Open Food Facts search. No key. Allergen tags and per-100g macros. */
export async function lookupFoodFacts(items: string[]): Promise<FoodFact[]> {
  const unique = [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 1))].slice(
    0,
    4,
  );
  const facts = await Promise.all(
    unique.map(async (item): Promise<FoodFact | null> => {
      const json = (await getJson(
        `https://search.openfoodfacts.org/search?q=${encodeURIComponent(item)}&page_size=3`,
      )) as {
        hits?: Array<{
          product_name?: string;
          allergens_tags?: string[];
          nutriments?: Record<string, unknown>;
        }>;
      } | null;
      const hits = (json?.hits ?? []).filter((hit) => productMatchesItem(item, hit.product_name));
      const product = hits[0];
      if (!product) return null;
      const allergens = product.allergens_tags ?? [];
      const nutriments = product.nutriments ?? {};
      return {
        item,
        product: product.product_name,
        allergens,
        proteinPer100g: asNumber(nutriments.proteins_100g),
        kcalPer100g: asNumber(nutriments["energy-kcal_100g"]),
      };
    }),
  );
  return facts.filter((fact): fact is FoodFact => fact !== null);
}

export function hiddenAllergenHits(facts: FoodFact[], allergies: string[]): HiddenAllergen[] {
  const hits: HiddenAllergen[] = [];
  for (const fact of facts) {
    for (const tag of fact.allergens) {
      const label = TAG_LABEL[tag] ?? tag.replace(/^en:/, "").replace(/-/g, " ");
      const allergy = allergyConflict(label, allergies);
      if (!allergy) continue;
      if (hits.some((hit) => hit.item === fact.item && hit.allergy === allergy)) continue;
      hits.push({ item: fact.item, allergy, tag });
    }
  }
  return hits;
}

export function nutritionLine(facts: FoodFact[]): string | null {
  const withProtein = facts.filter((fact) => fact.proteinPer100g !== undefined);
  if (!withProtein.length) return null;
  const bits = withProtein
    .slice(0, 3)
    .map((fact) => `${fact.item} ~${fact.proteinPer100g}g protein/100g`);
  return `Open Food Facts: ${bits.join("; ")}`;
}

export async function probeFreeFood(): Promise<FreeFoodProbe> {
  const [meals, facts] = await Promise.all([
    getJson("https://www.themealdb.com/api/json/v1/1/search.php?s=lentil"),
    getJson("https://search.openfoodfacts.org/search?q=lentil&page_size=1"),
  ]);
  const mealOk = Boolean(
    meals &&
      typeof meals === "object" &&
      "meals" in meals &&
      Array.isArray((meals as { meals?: unknown }).meals),
  );
  const factOk = Boolean(
    facts &&
      typeof facts === "object" &&
      "hits" in facts &&
      Array.isArray((facts as { hits?: unknown }).hits) &&
      ((facts as { hits: unknown[] }).hits.length > 0),
  );
  return { meals: mealOk, facts: factOk };
}
