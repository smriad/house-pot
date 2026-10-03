import type { KitchenRun } from "@/lib/types";

/** Entire-friendly session bundle for write-ups and judge review. */
export function buildEntireExport(run: KitchenRun) {
  return {
    format: "house-pot-entire-v1",
    project: "House Pot — Build for a Friend",
    openCore: "Gemma (open weights) + optional local Whisper",
    run: {
      id: run.id,
      householdId: run.householdId,
      status: run.status,
      createdAt: run.createdAt,
      preferenceScore: run.preferenceScore,
      predictionSource: run.predictionSource,
      fitReasons: run.fitReasons,
      serpInspiration: run.serpInspiration,
    },
    agentTrace: run.trace,
    integrationsUsed: run.trace.map((t) => t.step),
    recipeApprovedBeforeNarration: Boolean(
      run.trace.some((t) => t.step === "approve"),
    ),
    devrelayHint:
      "Embed a saved DevRelay agent session in your DEV post with {% agent_session ID %}",
  };
}
