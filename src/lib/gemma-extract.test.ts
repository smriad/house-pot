import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractRecipeJsonText } from "@/lib/gemma";

describe("extractRecipeJsonText", () => {
  it("strips thought blocks", () => {
    const raw = '<thought>planning</thought>{"title":"Dal"}';
    assert.equal(extractRecipeJsonText(raw), '{"title":"Dal"}');
  });

  it("pulls JSON from fenced blocks", () => {
    const raw = 'Here:\n```json\n{"title":"Pasta"}\n```';
    assert.equal(extractRecipeJsonText(raw), '{"title":"Pasta"}');
  });

  it("extracts outer object when surrounded by prose", () => {
    const raw = 'Note {"title":"Tofu","servings":2} done';
    assert.equal(extractRecipeJsonText(raw), '{"title":"Tofu","servings":2}');
  });
});
