import { getMastra } from "@/lib/mastra/instance";

export type ApprovalGateResult = {
  mastraRunId: string;
  question: string;
  proposalTitle: string;
};

/** Mastra workflow run — human-in-the-loop gate before side effects. */
export async function startApprovalGate(input: {
  cookName: string;
  allergies: string[];
  pantryText: string;
  diners: number;
}): Promise<ApprovalGateResult> {
  const question = `Approve a ${input.diners}-person meal for ${input.cookName}? Allergies: ${input.allergies.join(", ") || "none listed"}.`;

  try {
    const mastra = getMastra();
    const workflow = mastra.getWorkflow("kitchenApproval");
    const run = await workflow.createRun({ resourceId: input.cookName });
    await run.start({ inputData: input });
    return {
      mastraRunId: run.runId,
      question,
      proposalTitle: "Tonight's pot",
    };
  } catch {
    return {
      mastraRunId: "",
      question,
      proposalTitle: "Tonight's pot",
    };
  }
}

export async function resumeApprovalGate(
  mastraRunId: string,
  approved: boolean,
): Promise<void> {
  if (!mastraRunId) return;
  try {
    const mastra = getMastra();
    const workflow = mastra.getWorkflow("kitchenApproval");
    const stored = await workflow.getWorkflowRunById(mastraRunId);
    if (stored && "resume" in stored && typeof stored.resume === "function") {
      await (stored as { resume: (args: unknown) => Promise<unknown> }).resume({
        step: "propose-dish",
        resumeData: { approved },
      });
    }
  } catch {
    // Mastra storage may be unavailable in serverless cold starts; app approval still applies.
  }
}
