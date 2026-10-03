import assert from "node:assert/strict";
import test from "node:test";
import { hiddenAllergenHits, nutritionLine, productMatchesItem } from "./free-food";

test("Open Food Facts tags catch allergens the ingredient name hides", () => {
  const hits = hiddenAllergenHits(
    [
      {
        item: "soy sauce",
        allergens: ["en:gluten", "en:soybeans"],
        proteinPer100g: 8,
      },
    ],
    ["gluten"],
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.item, "soy sauce");
  assert.equal(hits[0]?.allergy, "gluten");
});

test("nutrition line uses protein per 100g", () => {
  const line = nutritionLine([
    { item: "lentils", allergens: [], proteinPer100g: 24 },
    { item: "rice", allergens: [] },
  ]);
  assert.equal(line, "Open Food Facts: lentils ~24g protein/100g");
});

test("a cheese product does not count as rice", () => {
  assert.equal(productMatchesItem("rice", "Fromage Blanc Nature"), false);
  assert.equal(productMatchesItem("rice", "Basmati rice"), true);
});
