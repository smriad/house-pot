import type { KitchenRun } from "@/lib/types";
import { getRun, saveRun } from "@/lib/db/store";

/** At-least-once safe steps: skip if this run already completed the step. */
export async function runIdempotentStep<T>(
  runId: string,
  stepId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found");

  const marker = `idempotent:${stepId}`;
  if (run.trace.some((e) => e.detail === marker)) {
    if (stepId === "elevenlabs-narrate" && run.audioBase64) {
      return Buffer.from(run.audioBase64, "base64") as T;
    }
    throw new Error(`Step ${stepId} already completed`);
  }

  const result = await fn();
  run.trace.push({
    at: new Date().toISOString(),
    step: stepId,
    detail: marker,
  });
  run.updatedAt = new Date().toISOString();
  await saveRun(run);
  return result;
}
