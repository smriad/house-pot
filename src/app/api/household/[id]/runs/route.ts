import { NextResponse } from "next/server";
import { getRun, listRunsForHousehold } from "@/lib/db/store";
import { summarizeRunForApi } from "@/lib/kitchen/run-summary";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id: householdId } = await params;
  const runId = new URL(req.url).searchParams.get("runId");
  if (runId) {
    const run = await getRun(runId);
    if (!run || run.householdId !== householdId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(summarizeRunForApi(run));
  }
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const skipParam = url.searchParams.get("skip");
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(limitParam ?? "20", 10) || 20),
  );
  const skip = Math.max(0, Number.parseInt(skipParam ?? "0", 10) || 0);
  const runs = await listRunsForHousehold(householdId, limit, skip);
  return NextResponse.json({
    runs: runs.map(summarizeRunForApi),
    skip,
    limit,
    hasMore: runs.length === limit,
  });
}
