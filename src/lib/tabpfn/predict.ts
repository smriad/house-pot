import { execFile } from "child_process";
import { promisify } from "util";
import type { Household, Recipe } from "@/lib/types";

const execFileAsync = promisify(execFile);

function pythonBin(): string {
  return (
    process.env.TABPFN_PYTHON?.trim() ||
    process.env.WHISPER_PYTHON?.trim() ||
    "python3"
  );
}

export type TabpfnResult = {
  score: number;
  source: "tabpfn" | "heuristic-fallback";
  reason: string;
};

export async function probeTabpfn(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      pythonBin(),
      ["-c", "import tabpfn; print('ok')"],
      { timeout: 45_000 },
    );
    return stdout.trim() === "ok";
  } catch {
    return false;
  }
}

export async function predictMealFit(
  household: Household,
  recipe: Recipe,
  memorySnippets: string[],
): Promise<TabpfnResult> {
  const memoryText = memorySnippets.join(" ").toLowerCase();
  const features = {
    diners: recipe.servings,
    allergy_count: household.allergies.length,
    pantry_token_count: recipe.ingredients.length,
    step_count: recipe.steps.length,
    spicy_flag: /chili|spicy|cayenne|hot sauce/i.test(
      `${recipe.title} ${recipe.summary}`,
    )
      ? 1
      : 0,
    memory_positive: /loved|again|favorite|perfect/i.test(memoryText) ? 1 : 0,
  };

  const script = `${process.cwd()}/scripts/tabpfn_score.py`;
  try {
    const { stdout } = await execFileAsync(pythonBin(), [script], {
      timeout: 120_000,
      maxBuffer: 1_048_576,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      input: JSON.stringify(features),
    });
    const parsed = JSON.parse(stdout.trim()) as TabpfnResult;
    return parsed;
  } catch {
    return {
      score: 72,
      source: "heuristic-fallback",
      reason: "TabPFN script unavailable; using inline fallback",
    };
  }
}
