import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/store";

/** Export agent trace JSON (Sentry / Entire session companion). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    runId: run.id,
    householdId: run.householdId,
    status: run.status,
    trace: run.trace,
    preferenceScore: run.preferenceScore,
    fitReasons: run.fitReasons,
    integrations: {
      mastraRunId: run.mastraRunId,
      substituteNotes: run.substituteNotes,
      shoppingNotes: run.shoppingNotes,
    },
  };
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="house-pot-trace-${id}.json"`,
    },
  });
}
