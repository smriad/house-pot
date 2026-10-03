import { hasElevenLabs } from "@/lib/env";

/** Restricted keys often lack `user_read`; verify TTS access like the app does. */
export async function probeElevenLabs(): Promise<boolean> {
  if (!hasElevenLabs()) return false;

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: ".",
          model_id: "eleven_multilingual_v2",
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
