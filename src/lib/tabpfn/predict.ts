import { execFile, spawn } from "child_process";
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

function runPythonWithStdin(script: string, stdin: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), [script], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("TabPFN script timed out"));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `python exit ${code}`));
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
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

function heuristicMealFit(
  household: Household,
  recipe: Recipe,
  memorySnippets: string[],
): TabpfnResult {
  const memoryText = memorySnippets.join(" ").toLowerCase();
  const diners = recipe.servings;
  const allergies = household.allergies.length;
  const pantry_len = recipe.ingredients.length;
  const steps = recipe.steps.length;
  const spicy = /chili|spicy|cayenne|hot sauce/i.test(
    `${recipe.title} ${recipe.summary}`,
  )
    ? 1
    : 0;
  const memory_pos = /loved|again|favorite|perfect/i.test(memoryText) ? 1 : 0;
  let score =
    70 + Math.min(pantry_len, 20) * 0.5 - allergies * 8 - spicy * 10 + memory_pos * 12;
  score = Math.max(5, Math.min(98, score));
  return {
    score: Math.round(score),
    source: "heuristic-fallback",
    reason: "TabPFN script unavailable; using inline fallback",
  };
}

export async function predictMealFit(
  household: Household,
  recipe: Recipe,
  memorySnippets: string[],
): Promise<TabpfnResult> {
  if (process.env.TABPFN_DISABLE === "true") {
    return heuristicMealFit(household, recipe, memorySnippets);
  }
  const tabpfnReady = await probeTabpfn();
  if (!tabpfnReady) {
    return heuristicMealFit(household, recipe, memorySnippets);
  }
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
    const stdout = await runPythonWithStdin(
      script,
      JSON.stringify(features),
      120_000,
    );
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
