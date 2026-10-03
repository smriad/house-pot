import { NextResponse } from "next/server";
import { z } from "zod";
import { recordCookFeedback } from "@/lib/kitchen/orchestrator";

const bodySchema = z.object({ feedback: z.string().min(3).max(2000) });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const run = await recordCookFeedback(id, parsed.data.feedback);
    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Feedback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
