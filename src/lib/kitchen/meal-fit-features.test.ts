import { test } from "node:test";
import assert from "node:assert/strict";
import { feedbackSentimentLabel } from "@/lib/kitchen/meal-fit-features";

test("feedbackSentimentLabel", () => {
  assert.equal(feedbackSentimentLabel("loved it, cook again"), 1);
  assert.equal(feedbackSentimentLabel("too spicy, never again"), 0);
  assert.equal(feedbackSentimentLabel("less cumin next time"), 0.5);
});
