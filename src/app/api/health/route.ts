import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/integrations/status";

export async function GET() {
  const status = await getIntegrationStatus();
  return NextResponse.json({
    ok: true,
    integrations: {
      gemma: status.gemma.live,
      mongodb: status.mongodb.reachable,
      elevenlabs: status.elevenlabs.live,
      elevenlabsStt: status.elevenlabs.stt,
      serpapi: status.serpapi.live,
      whisper: status.whisper.live,
      whisperNote: status.whisper.note,
      mastra: status.mastra.enabled,
      sentry: status.sentry.configured,
      temporal: status.temporal.reachable,
      embeddings: status.embeddings.live,
      backboard: status.backboard.reachable,
      storage: status.storage,
    },
    detail: status,
  });
}
