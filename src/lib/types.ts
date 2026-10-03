import { z } from "zod";
import type { PantryReview } from "@/lib/kitchen/pantry-check";

export const householdSchema = z.object({
  id: z.string(),
  cookName: z.string().min(1),
  allergies: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  favoriteCuisines: z.array(z.string()).default([]),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Household = z.infer<typeof householdSchema>;

export type PantryMemory = {
  id: string;
  householdId: string;
  text: string;
  tags: string[];
  createdAt: string;
};

export const recipeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  servings: z.number().int().positive(),
  ingredients: z.array(
    z.object({
      item: z.string(),
      amount: z.string(),
      substitute: z.string().optional(),
    }),
  ),
  steps: z.array(z.string()),
  allergyWarnings: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  openSourceRationale: z.string(),
});

export type Recipe = z.infer<typeof recipeSchema>;

export type FoodFact = {
  item: string;
  product?: string;
  allergens: string[];
  proteinPer100g?: number;
  kcalPer100g?: number;
};

export type KitchenBrain = {
  mealIdeas: string[];
  foodFacts: FoodFact[];
  criticNotes: string[];
  criticModel?: string;
  heat?: string;
  revised: boolean;
};

export type RunStatus =
  | "awaiting_approval"
  | "approved"
  | "narrated"
  | "failed";

export type KitchenRun = {
  id: string;
  householdId: string;
  pantryText: string;
  voiceTranscript?: string;
  diners: number;
  status: RunStatus;
  proposal?: Recipe;
  substituteNotes?: string[];
  shoppingNotes?: string[];
  preferenceScore?: number;
  predictionSource?: string;
  fitReasons?: string[];
  serpInspiration?: string[];
  audioBase64?: string;
  mastraRunId?: string;
  approvalQuestion?: string;
  pantryReview?: PantryReview;
  kitchenBrain?: KitchenBrain;
  /** LLM one-liner for the cook after propose (same GEMMA endpoint). */
  cookBrief?: string;
  cookFeedback?: string;
  trace: RunTraceEvent[];
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type RunTraceEvent = {
  at: string;
  step: string;
  detail: string;
  ms?: number;
};

export const startRunInputSchema = z.object({
  householdId: z.string(),
  pantryText: z.string().min(3),
  voiceTranscript: z.string().optional(),
  diners: z.number().int().min(1).max(12).default(2),
});
