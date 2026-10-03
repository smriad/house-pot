import { NextResponse } from "next/server";
import { listMemories } from "@/lib/db/store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const memories = await listMemories(id);
  return NextResponse.json({ memories });
}
