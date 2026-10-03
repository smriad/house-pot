#!/usr/bin/env python3
"""Local Whisper transcription (open-source). pip install -r requirements.txt"""
import sys
import tempfile
import os

def main() -> int:
    if len(sys.argv) < 2:
        print("usage: transcribe.py <audio-file>", file=sys.stderr)
        return 1
    path = sys.argv[1]
    try:
        import whisper  # type: ignore
    except ImportError:
        print("whisper not installed; run: pip install -r requirements.txt", file=sys.stderr)
        return 2
    model_name = os.environ.get("WHISPER_MODEL", "base")
    model = whisper.load_model(model_name)
    result = model.transcribe(path, fp16=False, language="en")
    text = (result.get("text") or "").strip()
    print(text)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
