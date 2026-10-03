import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { hasElevenLabs } from "@/lib/env";
import { transcribePantryAudio } from "@/lib/elevenlabs";

const execFileAsync = promisify(execFile);

export type TranscribeEngine =
  | "whisper-local"
  | "elevenlabs-scribe"
  | "unavailable";

export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
): Promise<{ text: string; engine: TranscribeEngine }> {
  const tmpDir = path.join(process.cwd(), ".data", "uploads");
  await fs.mkdir(tmpDir, { recursive: true });
  const ext = path.extname(filename) || ".webm";
  const filePath = path.join(tmpDir, `${randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);

  try {
    const script = path.join(process.cwd(), "scripts", "transcribe.py");
    const pythons = [
      process.env.WHISPER_PYTHON?.trim(),
      "python3",
    ].filter((v): v is string => Boolean(v));
    let stdout = "";
    let lastErr: unknown;
    for (const python of [...new Set(pythons)]) {
      try {
        const result = await execFileAsync(python, [script, filePath], {
          timeout: 120_000,
          maxBuffer: 2 * 1024 * 1024,
        });
        stdout = result.stdout;
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    const text = stdout.trim();
    if (!text) {
      return { text: "", engine: "unavailable" };
    }
    return { text, engine: "whisper-local" };
  } catch {
    if (hasElevenLabs()) {
      try {
        const text = await transcribePantryAudio(buffer, filename);
        if (text) return { text, engine: "elevenlabs-scribe" };
      } catch {
        /* fall through */
      }
    }
    return { text: "", engine: "unavailable" };
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
}
