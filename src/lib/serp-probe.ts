import { getJson } from "serpapi";
import { hasSerpApi } from "@/lib/env";

export async function probeSerpApi(): Promise<boolean> {
  if (!hasSerpApi()) return false;
  try {
    const json = await getJson({
      engine: "google",
      q: "house pot test",
      api_key: process.env.SERPAPI_API_KEY,
      num: 1,
    });
    return Boolean(json.search_metadata?.status === "Success");
  } catch {
    return false;
  }
}
