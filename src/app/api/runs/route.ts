import { NextResponse } from "next/server";
import { startKitchenRun } from "@/lib/kitchen/orchestrator";
import { startRunInputSchema } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = startRunInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const run = await startKitchenRun(parsed.data);
    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
