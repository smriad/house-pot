import { randomUUID } from "crypto";
import {
  addPantryMemory,
  getHousehold,
  getRun,
  saveRun,
  searchMemories,
} from "@/lib/db/store";
import { proposeRecipe } from "@/lib/gemma";
import { findMealInspiration, findSubstitutes } from "@/lib/serp";
import { narrateRecipe } from "@/lib/elevenlabs";
import type { KitchenRun, RunTraceEvent } from "@/lib/types";
import { withAgentSpan } from "@/lib/observability/agent-trace";
import {
  resumeApprovalGate,
  startApprovalGate,
} from "@/lib/mastra/approval-gate";
import { runIdempotentStep } from "@/lib/durable/steps";
import { useTemporalNarration } from "@/lib/env";
import { executeNarrationWorkflow, probeTemporal } from "@/lib/temporal/client";
import { addBackboardMemory, searchBackboardMemories } from "@/lib/backboard";
import { buildShoppingNotes } from "@/lib/kitchen/shopping";
import { scoreRecipeFit } from "@/lib/kitchen/preference-score";
import { predictMealFit } from "@/lib/tabpfn/predict";
import { mirrorMemoryToTiger } from "@/lib/tiger/memory";

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

  const recipe = await runStep(run, "gemma-propose", () =>
    proposeRecipe({
      cookName: household.cookName,
      allergies: household.allergies,
      dislikes: household.dislikes,
      cuisines: household.favoriteCuisines,
      pantryText: input.pantryText,
      voiceTranscript: input.voiceTranscript,
      diners: input.diners,
      memorySnippets,
      substituteHints,
      serpInspiration: serpIdeas,
    }),
  );

  run.proposal = recipe;
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
    useTemporalNarration() &&
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
  return run;
}
