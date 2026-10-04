import { z } from "zod";
import { extractRecipeJsonText, kitchenChat, probeGemma } from "@/lib/gemma";

const extractSchema = z.object({
  pantryLine: z.string().min(3),
  items: z.array(z.string()).min(1),
  diners: z.number().int().min(1).max(12).optional(),
});

export type PantryExtract = z.infer<typeof extractSchema>;

export async function extractPantryFromTranscript(
  transcript: string,
  cookName?: string,
): Promise<PantryExtract | null> {
  if (!transcript.trim()) return null;
  if (!(await probeGemma())) return null;

  const raw = await kitchenChat(
    `You extract pantry lists from a cook's voice note for ${cookName ?? "the cook"}.
Return JSON only: { "pantryLine": "comma-separated ingredients", "items": ["..."], "diners": optional number }.
Use English ingredient names; drop filler words.`,
    JSON.stringify({ transcript }),
  );
  if (!raw) return null;

  try {
    const json = JSON.parse(extractRecipeJsonText(raw));
    const parsed = extractSchema.safeParse(json);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
