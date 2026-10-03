import { NextResponse } from "next/server";
import { z } from "zod";
import { approveKitchenRun } from "@/lib/kitchen/orchestrator";

const bodySchema = z.object({
  approved: z.boolean(),
  autoNarrate: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const run = await approveKitchenRun(id, parsed.data.approved, {
      autoNarrate: parsed.data.autoNarrate,
    });
    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approve failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
