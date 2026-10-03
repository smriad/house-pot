# House Pot

**Build for a Friend** — Hacktoberfest Weekend Challenge entry.

Phone-friendly web app for the household cook: pantry in → **open-weight Gemma** recipe out → human **approve** → **ElevenLabs** reads steps aloud.

## Integrations

| Sponsor / OSS | Status in app |
| --- | --- |
| **Gemma** | Meal planning via OpenAI-compatible API (`GEMMA_*`); auto-probes Ollama at `127.0.0.1:11434` |
| **Whisper** | Optional server transcription (`POST /api/transcribe`, `scripts/transcribe.py`) |
| **MongoDB Atlas** | Household + pantry + friend feedback memory |
| **Mastra** | Suspend/approve workflow (`@mastra/libsql` + `kitchen-workflow`) |
| **ElevenLabs** | Post-approval narration only |
| **SerpApi** | Substitute hints when pantry mentions missing items |
| **Sentry** | Agent spans on each orchestration step (`withAgentSpan`) |
| **Render** | `render.yaml` + `Dockerfile` (standalone Next output) |

Durable narration uses **idempotent steps** (`lib/durable/steps.ts`) so retries do not double-charge ElevenLabs.

## Quick start

```bash
cp .env.example .env.local
# Add ELEVENLABS_API_KEY, optional MONGODB_URI, SERPAPI_API_KEY, SENTRY_DSN
# Gemma: ollama pull gemma3:4b  (or set GEMMA_BASE_URL)
# Whisper (optional): pip install -r requirements.txt
npm run dev
```

Open http://localhost:3000

## API

| Route | Purpose |
| --- | --- |
| `POST /api/household` | Cook profile + allergies |
| `POST /api/transcribe` | Upload audio → local Whisper text |
| `POST /api/runs` | Propose recipe |
| `POST /api/runs/:id/approve` | `{ approved, autoNarrate? }` |
| `POST /api/runs/:id/narrate` | ElevenLabs MP3 |
| `POST /api/runs/:id/feedback` | Friend quote → Mongo memory |
| `GET /api/health` | Live integration probe |

## Deploy (Render)

1. Connect repo, use `render.yaml` or Docker.
2. Set env vars from `.env.example`.
3. For Whisper in production, use the `Dockerfile` (installs Python + whisper).

## DEV submission

See `SUBMISSION.md` and your draft on DEV (edit before Monday 12:59 PM Asia/Dhaka).

## License

MIT
