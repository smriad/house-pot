import { NextResponse } from "next/server";
import { narrateKitchenRun } from "@/lib/kitchen/orchestrator";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const run = await narrateKitchenRun(id);
    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Narration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
