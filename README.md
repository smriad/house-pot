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

## Deploy (Render — free tier)

House Pot on Render is a **demo slice**: hosted Gemma + MongoDB Atlas + ElevenLabs. Ollama, Whisper, TabPFN, and a Temporal worker do not run on Render Free (use local `npm run dev` or the demo video for the full stack).

### 1. MongoDB Atlas (free M0)

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Database user + network access (`0.0.0.0/0` for a quick demo, or Render’s egress IPs if you tighten later).
3. Copy the connection string into `MONGODB_URI`.

### 2. Hosted Gemma (pick one)

The app uses an **OpenAI-compatible** client (`GEMMA_*`). Ollama URLs will not work on Render.

**Groq (recommended for Render)**

Recipe propose uses OpenAI **`json_object`** mode. Groq’s Gemma 2 endpoint supports that reliably on the free tier.

1. Create an API key: [Groq Console](https://console.groq.com/keys).
2. In Render → **Environment**:

| Variable | Value |
| --- | --- |
| `GEMMA_BASE_URL` | `https://api.groq.com/openai/v1` |
| `GEMMA_API_KEY` | `gsk_...` |
| `GEMMA_MODEL` | `gemma2-9b-it` |

**Google AI Studio (Gemma 3)**

Same OpenAI-compatible base URL as Gemini, but some Gemma model IDs reject JSON mode. If propose fails with a 400 about JSON mode, use Groq above or self-host Ollama behind a tunnel.

| Variable | Value |
| --- | --- |
| `GEMMA_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `GEMMA_API_KEY` | key from [AI Studio](https://aistudio.google.com/apikey) |
| `GEMMA_MODEL` | `gemma-3-4b-it` (or another Gemma id listed in AI Studio) |

### 3. Render web service

1. [Render](https://render.com) → **New** → **Blueprint** → connect `smriad/house-pot` (or your fork).
2. Blueprint reads `render.yaml` (`plan: free`, health check `/api/health`).
3. Set **required** secrets in the dashboard (Blueprint marks `sync: false` vars):

   - `NEXT_PUBLIC_APP_URL` — `https://<your-service-name>.onrender.com` (set after the first deploy URL is known, then redeploy once).
   - `MONGODB_URI`, `GEMMA_*`, `ELEVENLABS_API_KEY` (and optional `SERPAPI_API_KEY`, Backboard, Sentry, Tiger).

4. `TEMPORAL_NARRATE` is **`false` in `render.yaml`** — do not set `TEMPORAL_ADDRESS` on free tier; narration stays in-process.

### 4. What works on the live URL

| Feature | On Render Free |
| --- | --- |
| Cook profile, propose, Mastra approve, narrate, feedback | Yes (with env above) |
| Integration panel / `GET /api/health` | Yes |
| Local Whisper (`POST /api/transcribe`) | No — use browser speech or ElevenLabs Scribe |
| TabPFN / Ollama embeddings | No |
| Temporal durable narration | No (`TEMPORAL_NARRATE=false`) |

**Docker / Whisper:** The `Dockerfile` installs Python + Whisper for a heavier host (e.g. DigitalOcean with credits). The default Render Blueprint uses **Node only** (`npm run build` / `npm start`), which matches the table above.

**Cold starts:** Free Render sleeps after idle; first request can take 30–60s. Mention that in your DEV demo if judges hit a slow load.

Hacktoberfest sponsor credits (Render, DigitalOcean) may be listed at [hacktoberfest.com/my/promos](https://hacktoberfest.com/my/promos).

## DEV submission

See `SUBMISSION.md` and your draft on DEV (edit before Monday 12:59 PM Asia/Dhaka).

## License

MIT
