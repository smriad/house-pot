import { NextResponse } from "next/server";
import { getHouseholdsByIds, listAllRuns } from "@/lib/db/store";
import { summarizeRunForList } from "@/lib/kitchen/run-summary";

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

  const runs = await listAllRuns(limit, skip, { listView: true });
  const householdIds = [...new Set(runs.map((r) => r.householdId))];
  const households = await getHouseholdsByIds(householdIds);

  const body = {
    runs: runs.map((r) => ({
      ...summarizeRunForList(r),
      cookName: households.get(r.householdId)?.cookName ?? "Cook",
    })),
    skip,
    limit,
    hasMore: runs.length === limit,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
