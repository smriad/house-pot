import { proxyActivities } from "@temporalio/workflow";

const { narrateRunActivity } = proxyActivities<{
  narrateRunActivity: (runId: string) => Promise<void>;
}>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3 },
});

export async function narrateApprovedRecipeWorkflow(runId: string): Promise<void> {
  await narrateRunActivity(runId);
}
