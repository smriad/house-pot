import { NextResponse } from "next/server";
import { z } from "zod";
import { getHousehold, upsertHousehold } from "@/lib/db/store";

const bodySchema = z.object({
  id: z.string().optional(),
  cookName: z.string().min(1),
  allergies: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  favoriteCuisines: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const household = await getHousehold(id);
  if (!household) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(household);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const household = await upsertHousehold(parsed.data);
    return NextResponse.json(household);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save household";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
