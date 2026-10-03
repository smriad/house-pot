import { NextResponse } from "next/server";
import { getRun, listRunsForHousehold } from "@/lib/db/store";
import type { KitchenRun } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

function summarizeRun(run: KitchenRun) {
  const { audioBase64: _audio, ...rest } = run;
  return rest;
}

export async function GET(req: Request, { params }: Params) {
  const { id: householdId } = await params;
  const runId = new URL(req.url).searchParams.get("runId");
  if (runId) {
    const run = await getRun(runId);
    if (!run || run.householdId !== householdId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(summarizeRun(run));
  }
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(limitParam ?? "20", 10) || 20),
  );
  const runs = await listRunsForHousehold(householdId, limit);
  return NextResponse.json({ runs: runs.map(summarizeRun) });
}
