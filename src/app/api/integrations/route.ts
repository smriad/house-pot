import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/integrations/status";

export async function GET() {
  const status = await getIntegrationStatus();
  return NextResponse.json({ ok: true, ...status });
}
