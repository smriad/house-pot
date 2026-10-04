import { randomUUID } from "crypto";
import {
  addPantryMemory,
  getHousehold,
  getRun,
  insertMealFitTrainingRow,
  saveRun,
  searchMemories,
} from "@/lib/db/store";
import { semanticAllergenHints } from "@/lib/kitchen/allergen-semantics";
import { proposeWithRanking } from "@/lib/kitchen/propose-rank";
import { findMealInspiration, findSubstitutes } from "@/lib/serp";
import { narrateRecipe } from "@/lib/elevenlabs";
import type { FoodFact, KitchenRun, RunTraceEvent } from "@/lib/types";
import { withAgentSpan } from "@/lib/observability/agent-trace";
import {
  resumeApprovalGate,
  startApprovalGate,
} from "@/lib/mastra/approval-gate";
import { runIdempotentStep } from "@/lib/durable/steps";
import { temporalNarrationEnabled } from "@/lib/env";
import { executeNarrationWorkflow, probeTemporal } from "@/lib/temporal/client";
import { addBackboardMemory, searchBackboardMemories } from "@/lib/backboard";
import { buildShoppingNotes } from "@/lib/kitchen/shopping";
import { scoreRecipeFit } from "@/lib/kitchen/preference-score";
import { reviewProposal, type PantryReview } from "@/lib/kitchen/pantry-check";
import {
  fetchMealIdeas,
  hiddenAllergenHits,
  lookupFoodFacts,
  nutritionLine,
} from "@/lib/kitchen/free-food";
import { critiqueRecipe } from "@/lib/kitchen/critic";
import { buildCookBrief } from "@/lib/kitchen/cook-brief";
import { predictMealFit } from "@/lib/tabpfn/predict";
import { mirrorMemoryToTiger } from "@/lib/tiger/memory";
import {
  buildMealFitFeatures,
  feedbackSentimentLabel,
} from "@/lib/kitchen/meal-fit-features";

function applyFoodFacts(review: PantryReview, facts: FoodFact[], allergies: string[]): PantryReview {
  const hidden = hiddenAllergenHits(facts, allergies);
  if (!hidden.length) return review;
  const allergyHits = [...new Set([...review.allergyHits, ...hidden.map((hit) => hit.allergy)])];
  return { ...review, allergyHits, safeToNarrate: false };
}

function trace(step: string, detail: string, ms?: number): RunTraceEvent {
  return { at: new Date().toISOString(), step, detail, ms };
}

async function runStep<T>(
  run: KitchenRun,
  step: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  return withAgentSpan(step, { runId: run.id, householdId: run.householdId }, async () => {
    try {
      const result = await fn();
      run.trace.push(trace(step, `ok in ${Date.now() - started}ms`));
      await saveRun(run);
      return result;
    } catch (err) {
      run.trace.push(
        trace(step, `failed: ${err instanceof Error ? err.message : "unknown"}`),
      );
      run.status = "failed";
      await saveRun(run);
      throw err;
    }
  });
}

export async function startKitchenRun(input: {
  householdId: string;
  pantryText: string;
  voiceTranscript?: string;
  diners: number;
}): Promise<KitchenRun> {
  const household = await getHousehold(input.householdId);
  if (!household) {
    throw new Error("Household not found");
  }

  const run: KitchenRun = {
    id: randomUUID(),
    householdId: input.householdId,
    pantryText: input.pantryText,
    voiceTranscript: input.voiceTranscript,
    diners: input.diners,
    status: "awaiting_approval",
    trace: [trace("start", "run created")],
    idempotencyKey: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveRun(run);

  const gate = await runStep(run, "mastra-approval-gate", () =>
    startApprovalGate({
      cookName: household.cookName,
      allergies: household.allergies,
      pantryText: input.pantryText,
      diners: input.diners,
    }),
  );
  run.mastraRunId = gate.mastraRunId;
  run.approvalQuestion = gate.question;
  await saveRun(run);

  const memories = await searchMemories(
    household.id,
    `${input.pantryText} ${input.voiceTranscript ?? ""}`,
  );
  const backboardHits = await runStep(run, "backboard-memory", async () =>
    searchBackboardMemories(
      `${household.cookName} allergies ${household.allergies.join(" ")} pantry ${input.pantryText}`,
    ),
  );
  const memorySnippets = [
    ...memories.map((m) => m.text),
    ...backboardHits.map((m) => m.content),
  ];

  const missingGuess = input.pantryText
    .split(/[,.\n]/)
    .map((s) => s.trim())
    .filter((s) => /need|missing|out of/i.test(s))
    .slice(0, 2);

  let substituteHints: string[] = [];
  if (missingGuess.length) {
    substituteHints = await runStep(run, "serp-substitutes", () =>
      findSubstitutes(missingGuess[0], household.allergies),
    );
  }

  const serpIdeas = await runStep(run, "serp-inspiration", () =>
    findMealInspiration(household.favoriteCuisines, input.pantryText),
  );
  run.serpInspiration = serpIdeas;

  const mealIdeas = await runStep(run, "themealdb", () => fetchMealIdeas(input.pantryText));

  const ranked = await runStep(run, "gemma-propose", () =>
    proposeWithRanking({
      household,
      pantryText: input.pantryText,
      voiceTranscript: input.voiceTranscript,
      diners: input.diners,
      memorySnippets,
      substituteHints,
      serpInspiration: serpIdeas,
      publicRecipeIdeas: mealIdeas,
    }),
  );
  let recipe = ranked.recipe;
  if (ranked.alternateTitles.length) {
    run.alternateTitles = ranked.alternateTitles;
    run.trace.push(
      trace("gemma-rank", `also considered: ${ranked.alternateTitles.join("; ")}`),
    );
  }

  let foodFacts = await runStep(run, "openfoodfacts", () =>
    lookupFoodFacts(recipe.ingredients.map((ingredient) => ingredient.item)),
  );
  let review = applyFoodFacts(
    reviewProposal(recipe, input.pantryText, household.allergies),
    foodFacts,
    household.allergies,
  );
  const semanticHints = await runStep(run, "allergen-embed-hints", () =>
    semanticAllergenHints(
      recipe.ingredients.map((i) => i.item),
      household.allergies,
    ),
  );
  if (semanticHints.length) {
    review = { ...review, semanticHints };
  }

  const critique = await runStep(run, "gemma-critic", () =>
    critiqueRecipe({
      cookName: household.cookName,
      allergies: household.allergies,
      dislikes: household.dislikes,
      pantryText: input.pantryText,
      recipe,
      review,
      foodFacts,
    }),
  );
  if (critique.revised && critique.recipe) {
    recipe = critique.recipe;
    foodFacts = await lookupFoodFacts(recipe.ingredients.map((ingredient) => ingredient.item));
    review = applyFoodFacts(
      reviewProposal(recipe, input.pantryText, household.allergies),
      foodFacts,
      household.allergies,
    );
    if (semanticHints.length) {
      review = { ...review, semanticHints };
    }
  }

  const criticNotes = [...critique.notes];
  const macros = nutritionLine(foodFacts);
  if (macros) criticNotes.push(macros);

  run.proposal = recipe;
  run.kitchenBrain = {
    mealIdeas,
    foodFacts,
    criticNotes,
    criticModel: critique.model,
    heat: critique.heat,
    revised: critique.revised,
  };
  run.pantryReview = review;
  if (review.allergyHits.length > 0) {
    recipe.allergyWarnings = [
      ...new Set([
        ...recipe.allergyWarnings,
        ...review.allergyHits.map((allergy) => `Contains ${allergy}`),
      ]),
    ];
  }
  run.trace.push(
    trace(
      "pantry-check",
      review.safeToNarrate
        ? `missing: ${review.missing.join(", ") || "none"}`
        : `blocked: ${review.allergyHits.join(", ")}`,
    ),
  );
  run.substituteNotes = substituteHints;
  const shopping = await runStep(run, "shopping-serp", () =>
    buildShoppingNotes(recipe, input.pantryText, household.allergies),
  );
  run.shoppingNotes = shopping;
  const fit = scoreRecipeFit(household, recipe, memorySnippets);
  const tabpfn = await runStep(run, "tabpfn-predict", () =>
    predictMealFit(household, recipe, memorySnippets),
  );
  run.preferenceScore = Math.round((fit.score + tabpfn.score) / 2);
  run.predictionSource = tabpfn.source;
  run.fitReasons = [...fit.reasons, tabpfn.reason];

  const brief = await runStep(run, "gemma-brief", () =>
    buildCookBrief({
      cookName: household.cookName,
      recipe,
      preferenceScore: run.preferenceScore,
      revised: critique.revised,
    }),
  );
  if (brief) run.cookBrief = brief;

  run.updatedAt = new Date().toISOString();
  run.trace.push(trace("propose", `recipe: ${recipe.title}`));
  await saveRun(run);

  await addPantryMemory(household.id, input.pantryText, ["pantry", "run"]);
  return run;
}

export async function approveKitchenRun(
  runId: string,
  approved: boolean,
  options?: { autoNarrate?: boolean },
): Promise<KitchenRun> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found");

  if (approved && run.proposal) {
    const cook = await getHousehold(run.householdId);
    const review = reviewProposal(run.proposal, run.pantryText, cook?.allergies ?? []);
    run.pantryReview = review;
    if (!review.safeToNarrate) {
      run.trace.push(trace("approve", `blocked: ${review.allergyHits.join(", ")}`));
      run.updatedAt = new Date().toISOString();
      await saveRun(run);
      throw new Error(
        `This pot includes ${review.allergyHits.join(", ")}. House Pot will not read it aloud.`,
      );
    }
  }

  if (run.mastraRunId) {
    try {
      await resumeApprovalGate(run.mastraRunId, approved);
      run.trace.push(trace("mastra-resume", approved ? "approved" : "declined"));
    } catch {
      run.trace.push(trace("mastra-resume", "skipped (storage unavailable)"));
    }
  }

  if (!approved) {
    run.status = "failed";
    run.trace.push(trace("approve", "cook declined the proposal"));
    run.updatedAt = new Date().toISOString();
    await saveRun(run);
    return run;
  }

  run.status = "approved";
  run.trace.push(trace("approve", "cook approved — safe to narrate"));
  run.updatedAt = new Date().toISOString();
  await saveRun(run);

  if (options?.autoNarrate) {
    return narrateKitchenRun(runId);
  }
  return run;
}

export async function narrateKitchenRun(
  runId: string,
  options?: { skipTemporal?: boolean },
): Promise<KitchenRun> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found");
  if (!run.proposal) throw new Error("No recipe proposal on this run");
  const cook = await getHousehold(run.householdId);
  const review = reviewProposal(run.proposal, run.pantryText, cook?.allergies ?? []);
  if (!review.safeToNarrate) {
    throw new Error(
      `This pot includes ${review.allergyHits.join(", ")}. House Pot will not read it aloud.`,
    );
  }
  const cookApproved = run.trace.some(
    (t) => t.step === "approve" && t.detail.includes("approved"),
  );
  if (
    run.status !== "approved" &&
    run.status !== "narrated" &&
    !(run.status === "failed" && cookApproved)
  ) {
    throw new Error("Run must be approved before narration");
  }
  if (run.status === "failed" && cookApproved) {
    run.status = "approved";
    await saveRun(run);
  }

  if (
    !options?.skipTemporal &&
    temporalNarrationEnabled() &&
    (await probeTemporal())
  ) {
    try {
      await runStep(run, "temporal-narrate", () =>
        executeNarrationWorkflow(runId),
      );
      const updated = await getRun(runId);
      if (updated?.status === "narrated") return updated;
    } catch {
      const recovered = await getRun(runId);
      if (recovered?.status === "failed") {
        recovered.status = "approved";
        await saveRun(recovered);
      }
    }
  }

  const audio = await withAgentSpan(
    "elevenlabs-narrate",
    { runId: run.id },
    async () =>
      runIdempotentStep(runId, "elevenlabs-narrate", () =>
        narrateRecipe(run.proposal!),
      ),
  );

  const fresh = (await getRun(runId)) ?? run;
  fresh.audioBase64 = audio.toString("base64");
  fresh.status = "narrated";
  fresh.updatedAt = new Date().toISOString();
  fresh.trace.push(trace("narrate", `audio bytes: ${audio.length}`));
  await saveRun(fresh);
  return fresh;
}

export async function recordCookFeedback(
  runId: string,
  feedback: string,
): Promise<KitchenRun> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found");
  run.cookFeedback = feedback.trim();
  run.trace.push(trace("feedback", feedback.slice(0, 120)));
  run.updatedAt = new Date().toISOString();
  await saveRun(run);
  await addPantryMemory(run.householdId, `Cook said: ${feedback}`, [
    "feedback",
    "friend",
  ]);
  await addBackboardMemory(`Cook feedback for run ${runId}: ${feedback}`, {
    householdId: run.householdId,
    source: "house-pot",
  });
  await mirrorMemoryToTiger(run.householdId, feedback);

  const household = await getHousehold(run.householdId);
  if (household && run.proposal) {
    const memories = await searchMemories(household.id, run.pantryText);
    const memorySnippets = memories.map((m) => m.text);
    await insertMealFitTrainingRow({
      runId: run.id,
      householdId: run.householdId,
      features: buildMealFitFeatures(household, run.proposal, memorySnippets),
      preferenceScore: run.preferenceScore,
      feedbackText: feedback,
      label: feedbackSentimentLabel(feedback),
      recipeTitle: run.proposal.title,
    });
    run.trace.push(trace("meal-fit-training", "feedback row stored"));
    await saveRun(run);
  }

  return run;
}
