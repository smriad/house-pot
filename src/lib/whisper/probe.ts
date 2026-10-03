import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function pythonCandidates(): string[] {
  const fromEnv = process.env.WHISPER_PYTHON?.trim();
  const list = [fromEnv, "python3"].filter((v): v is string => Boolean(v));
  return [...new Set(list)];
}

export async function probeWhisper(): Promise<boolean> {
  for (const python of pythonCandidates()) {
    try {
      await execFileAsync(python, ["-c", "import whisper; print('ok')"], {
        timeout: 15_000,
      });
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}
