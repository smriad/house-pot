import { narrateKitchenRun } from "../lib/kitchen/orchestrator";

export async function narrateRunActivity(runId: string): Promise<void> {
  await narrateKitchenRun(runId, { skipTemporal: true });
}
