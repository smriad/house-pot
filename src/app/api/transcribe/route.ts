import { NextResponse } from "next/server";
import { transcribeAudioBuffer } from "@/lib/whisper/transcribe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, engine } = await transcribeAudioBuffer(buffer, file.name);
    if (!text) {
      return NextResponse.json(
        {
          error:
            "No STT available. Install Whisper (pip install -r requirements.txt), set ELEVENLABS_API_KEY for Scribe, or use browser speech.",
          engine,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ text, engine });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
