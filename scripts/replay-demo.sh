#!/usr/bin/env bash
# Replay the House Pot smoke-test narration locally (for demo videos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MP3="$ROOT/.data/smoke-narration.mp3"
if [[ ! -f "$MP3" ]]; then
  echo "Missing $MP3 — run a narrated pot in the UI first, or:"
  echo "  curl -s http://localhost:3000/api/runs/<RUN_ID> | python3 -c \"...\"  # see README"
  exit 1
fi
echo "Playing ElevenLabs narration (~$(du -h "$MP3" | cut -f1))…"
afplay "$MP3"
