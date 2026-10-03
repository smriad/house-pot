import { getJson } from "serpapi";
import { hasSerpApi } from "@/lib/env";

export async function findSubstitutes(
  missingItem: string,
  allergyContext: string[],
): Promise<string[]> {
  if (!hasSerpApi()) return [];

  const query = `cooking substitute for ${missingItem} allergy safe ${allergyContext.join(" ")}`;
  const json = await getJson({
    engine: "google",
    q: query,
    api_key: process.env.SERPAPI_API_KEY,
    num: 3,
  });

  const organic = (json.organic_results as { snippet?: string }[] | undefined) ?? [];
  return organic
    .map((r) => r.snippet?.trim())
    .filter((s): s is string => Boolean(s))
    .slice(0, 3);
}

export async function findMealInspiration(
  cuisines: string[],
  pantryText: string,
): Promise<string[]> {
  if (!hasSerpApi()) return [];
  const cuisine = cuisines[0] ?? "comfort food";
  const query = `${cuisine} dinner ideas simple pantry ${pantryText.slice(0, 60)}`;
  const json = await getJson({
    engine: "google",
    q: query,
    api_key: process.env.SERPAPI_API_KEY,
    num: 3,
  });
  const organic = (json.organic_results as { title?: string; snippet?: string }[] | undefined) ?? [];
  return organic
    .map((r) => {
      const t = r.title?.trim();
      const s = r.snippet?.trim();
      if (t && s) return `${t}: ${s}`;
      return t || s || "";
    })
    .filter(Boolean)
    .slice(0, 3);
}
