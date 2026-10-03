#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Docker: Mongo + Temporal"
docker compose -f docker-compose.local.yml up -d

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installing Ollama (Homebrew)…"
  brew install ollama
fi

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "==> Starting Ollama…"
  brew services start ollama 2>/dev/null || (ollama serve >/tmp/ollama.log 2>&1 &)
  sleep 3
fi

echo "==> Pulling open-weight models (Gemma + embeddings)…"
ollama pull gemma3:4b
ollama pull nomic-embed-text

echo "==> Python Whisper"
python3 -m pip install -q -r requirements.txt

ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
GEMMA_BASE_URL=http://127.0.0.1:11434/v1
GEMMA_API_KEY=ollama
GEMMA_MODEL=gemma3:4b
EMBED_MODEL=nomic-embed-text

MONGODB_URI=mongodb://127.0.0.1:27017

TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

WHISPER_MODEL=base

# Add cloud keys from hacktoberfest.com/my for full green dashboard:
# ELEVENLABS_API_KEY=
# SERPAPI_API_KEY=
# BACKBOARD_API_KEY=
# BACKBOARD_ASSISTANT_ID=
# SENTRY_DSN=
EOF
  echo "Created .env.local (add ElevenLabs / SerpApi / Backboard / Sentry keys)"
else
  echo ".env.local already exists — not overwritten"
fi

echo ""
echo "Next:"
echo "  npm run dev"
echo "  npm run temporal:worker   # separate terminal"
echo "  open http://localhost:3000 → Show dashboard"
