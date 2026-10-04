import assert from "node:assert/strict";
import test from "node:test";
import { reviewProposal, slipIngredient } from "./pantry-check";
import type { Recipe } from "@/lib/types";

function recipe(ingredients: Recipe["ingredients"]): Recipe {
  return {
    title: "Test pot",
    summary: "A test",
    servings: 2,
    ingredients,
    steps: ["Cook it."],
    allergyWarnings: [],
    openSourceRationale: "test",
  };
}

const pantry = "red lentils, onion, garlic, rice, cumin, spinach, yogurt";

test("marks pantry items as on hand and flags what is missing", () => {
  const review = reviewProposal(
    recipe([
      { item: "red lentils", amount: "1 cup" },
      { item: "chicken", amount: "200 g" },
      { item: "salt", amount: "a pinch" },
    ]),
    pantry,
    ["peanuts"],
  );
  assert.equal(review.ingredients[0]?.onHand, true);
  assert.equal(review.ingredients[1]?.onHand, false);
  assert.equal(review.ingredients[2]?.staple, true);
  assert.deepEqual(review.missing, ["chicken"]);
  assert.equal(review.safeToNarrate, true);
});

test("blocks narration when an ingredient is the listed allergy", () => {
  const review = reviewProposal(
    recipe([{ item: "peanut oil", amount: "1 tbsp" }]),
    pantry,
    ["peanuts", "shellfish"],
  );
  assert.deepEqual(review.allergyHits, ["peanuts"]);
  assert.equal(review.safeToNarrate, false);
});

test("treats shrimp as shellfish", () => {
  const review = reviewProposal(
    recipe([{ item: "shrimp", amount: "6" }]),
    pantry,
    ["shellfish"],
  );
  assert.equal(review.safeToNarrate, false);
});

test("slipping shrimp into a safe dal blocks narration without calling the model", () => {
  const safe = recipe([{ item: "red lentils", amount: "1 cup" }]);
  assert.equal(reviewProposal(safe, pantry, ["peanuts", "shellfish"]).safeToNarrate, true);
  const slipped = slipIngredient(safe, "shrimp", "200 g");
  const review = reviewProposal(slipped, pantry, ["peanuts", "shellfish"]);
  assert.equal(review.safeToNarrate, false);
  assert.deepEqual(review.allergyHits, ["shellfish"]);
});

test("checks a substitute the same way as the ingredient", () => {
  const review = reviewProposal(
    recipe([{ item: "sunflower oil", amount: "1 tbsp", substitute: "peanut butter" }]),
    pantry,
    ["peanuts"],
  );
  assert.equal(review.safeToNarrate, false);
});
