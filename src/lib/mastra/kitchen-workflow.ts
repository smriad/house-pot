import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const contextSchema = z.object({
  cookName: z.string(),
  allergies: z.array(z.string()),
  pantryText: z.string(),
  diners: z.number(),
});

const proposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  question: z.string(),
});

const gatherContext = createStep({
  id: "gather-context",
  inputSchema: contextSchema,
  outputSchema: contextSchema.extend({
    normalizedPantry: z.string(),
  }),
  execute: async ({ inputData }) => ({
    ...inputData,
    normalizedPantry: inputData.pantryText.trim().toLowerCase(),
  }),
});

const proposeDish = createStep({
  id: "propose-dish",
  inputSchema: contextSchema.extend({ normalizedPantry: z.string() }),
  outputSchema: proposalSchema,
  suspendSchema: z.object({
    question: z.string(),
    proposalTitle: z.string(),
  }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const title = `Something warm with what's in the pot`;
    const summary = `A ${inputData.diners}-person plan for ${inputData.cookName} using: ${inputData.normalizedPantry.slice(0, 120)}`;
    if (!resumeData) {
      return await suspend({
        question: `Cook this for ${inputData.cookName}? Allergies checked: ${inputData.allergies.join(", ") || "none listed"}.`,
        proposalTitle: title,
      });
    }
    return {
      title,
      summary,
      question: resumeData.approved ? "approved" : "declined",
    };
  },
});

export const kitchenApprovalWorkflow = createWorkflow({
  id: "house-pot-approval",
  inputSchema: contextSchema,
  outputSchema: proposalSchema,
})
  .then(gatherContext)
  .then(proposeDish)
  .commit();
