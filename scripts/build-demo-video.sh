#!/usr/bin/env bash
# Build public/demo.mp4 from cover art + .data/demo-narration.mp3 (after a live narrate pass).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
AUDIO="${1:-$ROOT/.data/demo-narration.mp3}"
MAX="${2:-70}"
if [[ ! -f "$AUDIO" ]]; then
  echo "Missing $AUDIO — run a live approve+narrate pass first."
  exit 1
fi
ffmpeg -y -loop 1 -i public/cover.jpg -i "$AUDIO" \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p" \
  -c:v libx264 -t "$MAX" -c:a aac -shortest public/demo.mp4
echo "Wrote public/demo.mp4 ($(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 public/demo.mp4)s)"
