import type { Recipe } from "@/lib/types";

export type IngredientCheck = {
  item: string;
  amount: string;
  onHand: boolean;
  staple: boolean;
  allergyHit?: string;
};

export type PantryReview = {
  ingredients: IngredientCheck[];
  missing: string[];
  allergyHits: string[];
  safeToNarrate: boolean;
};

const STAPLES = new Set(["salt", "water", "oil", "pepper"]);

const ALLERGY_GROUPS: string[][] = [
  ["peanut", "peanuts", "groundnut", "groundnuts"],
  ["shellfish", "shrimp", "prawn", "prawns", "crab", "lobster"],
  ["dairy", "milk", "yogurt", "yoghurt", "cheese", "butter", "cream", "ghee", "paneer"],
  ["gluten", "wheat", "flour", "bread"],
  ["egg", "eggs"],
  ["soy", "soya", "tofu"],
  ["sesame"],
  ["fish"],
  ["almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pistachio", "pistachios"],
];

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function sameFood(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length > 3 && (a + "s" === b || b + "s" === a);
}

function groupFor(word: string): string[] | undefined {
  return ALLERGY_GROUPS.find((group) => group.some((member) => sameFood(word, member)));
}

export function allergyConflict(text: string, allergies: string[]): string | undefined {
  const words = tokens(text);
  for (const allergy of allergies) {
    const allergyWords = tokens(allergy);
    const needles = allergyWords.flatMap((word) => groupFor(word) ?? [word]);
    for (const word of words) {
      if (needles.some((needle) => sameFood(word, needle))) return allergy;
    }
  }
  return undefined;
}

function isStaple(item: string): boolean {
  const words = tokens(item).filter(
    (word) => !["black", "white", "cooking", "olive", "vegetable"].includes(word),
  );
  return words.length > 0 && words.every((word) => STAPLES.has(word));
}

function onHand(item: string, pantryTokens: Set<string>): boolean {
  if (isStaple(item)) return true;
  return tokens(item).some((word) =>
    [...pantryTokens].some((have) => sameFood(word, have)),
  );
}

export function reviewProposal(
  recipe: Recipe,
  pantryText: string,
  allergies: string[],
): PantryReview {
  const pantryTokens = new Set(tokens(pantryText));
  const ingredients = recipe.ingredients.map((ingredient) => {
    const allergyHit =
      allergyConflict(ingredient.item, allergies) ??
      (ingredient.substitute ? allergyConflict(ingredient.substitute, allergies) : undefined);
    return {
      item: ingredient.item,
      amount: ingredient.amount,
      onHand: onHand(ingredient.item, pantryTokens),
      staple: isStaple(ingredient.item),
      allergyHit,
    };
  });
  const allergyHits = [
    ...new Set(ingredients.flatMap((ingredient) => (ingredient.allergyHit ? [ingredient.allergyHit] : []))),
  ];
  return {
    ingredients,
    missing: ingredients.filter((ingredient) => !ingredient.onHand).map((ingredient) => ingredient.item),
    allergyHits,
    safeToNarrate: allergyHits.length === 0,
  };
}
