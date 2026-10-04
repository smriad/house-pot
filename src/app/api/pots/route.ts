import { NextResponse } from "next/server";
import { getHousehold, listAllRuns } from "@/lib/db/store";
import { summarizeRunForApi } from "@/lib/kitchen/run-summary";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );
  const skip = Math.max(
    0,
    Number.parseInt(url.searchParams.get("skip") ?? "0", 10) || 0,
  );

  const runs = await listAllRuns(limit, skip);
  const householdIds = [...new Set(runs.map((r) => r.householdId))];
  const cookByHousehold = new Map<string, string>();
  for (const id of householdIds) {
    const h = await getHousehold(id);
    cookByHousehold.set(id, h?.cookName ?? "Cook");
  }

  return NextResponse.json({
    runs: runs.map((r) => ({
      ...summarizeRunForApi(r),
      cookName: cookByHousehold.get(r.householdId) ?? "Cook",
    })),
    skip,
    limit,
    hasMore: runs.length === limit,
  });
}
