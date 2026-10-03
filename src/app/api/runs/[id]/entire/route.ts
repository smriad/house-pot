import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/store";
import { buildEntireExport } from "@/lib/entire/export";

/** Entire track: export agent session bundle for DEV write-up. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const payload = buildEntireExport(run);
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="house-pot-entire-${id}.json"`,
    },
  });
}
