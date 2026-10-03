# House Pot

House Pot is a Next.js application that plans household meals from pantry constraints, enforces allergy and pantry checks in application code (not only in prompts), requires explicit human approval before any text-to-speech, and persists cook profiles and run history in MongoDB Atlas.

**Live:** https://house-pot.onrender.com/  
**Local:** http://localhost:3000 (`npm run dev`)  
**Repository:** https://github.com/smriad/house-pot

---

## Local vs live

| | **Local** (`npm run dev`) | **Live** ([Render](https://house-pot.onrender.com/)) |
| --- | --- | --- |
| **Purpose** | Full stack, open-weight Gemma, debugging | Public demo for judges and cooks |
| **App URL** | `http://localhost:3000` | `https://house-pot.onrender.com` |
| **Health probe** | `http://localhost:3000/api/health` | `https://house-pot.onrender.com/api/health` |
| **History** | `/history` (uses `localStorage` household id) | Same; or `/history?household=<uuid>` |
| **LLM** | Ollama `gemma3:4b` at `127.0.0.1:11434` (recommended) | Hosted OpenAI-compatible API (`GEMMA_*` on Render) |
| **Gemma model** | `GEMMA_MODEL=gemma3:4b` | e.g. `gemini-3.8-flash` or `gemma-4-26b-a4b-it` on AI Studio |
| **Database** | Atlas **or** `.data/house-pot.json` if `MONGODB_URI` unset | MongoDB Atlas (`MONGODB_URI` required for persistent history) |
| **Embeddings** | Ollama `nomic-embed-text` | Google `text-embedding-004` when `GEMMA_*` is AI Studio |
| **Whisper STT** | Yes (`pip install -r requirements.txt`, `POST /api/transcribe`) | No on default Node blueprint |
| **TabPFN score** | Yes if Python + `requirements-tabpfn.txt` | Heuristic fallback only |
| **Temporal narration** | Yes with `npm run temporal:up` + worker | Off (`TEMPORAL_NARRATE=false` in `render.yaml`) |
| **Mastra LibSQL** | `.data/mastra.db` after first approve | Ephemeral disk on free tier |
| **ElevenLabs** | API key in `.env.local` | Same keys in Render dashboard |
| **TheMealDB / Open Food Facts** | Yes (public HTTP) | Yes |
| **SerpApi / Backboard / Tiger** | Optional env keys | Optional env keys |
| **Cold start** | None | Free tier may sleep; first request up to ~60s |
| **CI smoke** | `npm run smoke:prod` hits **live** only | GitHub Actions `live-smoke.yml` |

**Typical local `.env.local`:**

```env
GEMMA_BASE_URL=http://127.0.0.1:11434/v1
GEMMA_API_KEY=ollama
GEMMA_MODEL=gemma3:4b
MONGODB_URI=<Atlas or leave empty for .data JSON>
ELEVENLABS_API_KEY=<key>
```

**Typical live (Render) env:**

```env
NEXT_PUBLIC_APP_URL=https://house-pot.onrender.com
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMMA_API_KEY=<AI Studio key>
GEMMA_MODEL=gemini-3.8-flash
MONGODB_URI=<Atlas connection string>
ELEVENLABS_API_KEY=<key>
TEMPORAL_NARRATE=false
```

Use the in-app **Sponsor integrations** panel or `GET /api/health` on each environment to see which probes are `live`.

---

## Overview

The product targets a single household cook who needs a structured recipe from available ingredients while respecting allergies and dislikes. The system separates three concerns:

1. **Planning** — an OpenAI-compatible LLM (`GEMMA_*`) emits a JSON recipe (draft, optional critic pass, optional one-line cook brief).
2. **Safety** — deterministic pantry matching and allergen detection (`pantry-check.ts`), augmented by Open Food Facts allergen tags when available.
3. **Delivery** — ElevenLabs narrates **only** after the cook approves; narration requests are idempotent to avoid duplicate API charges on retry.

Voice input may use browser speech, ElevenLabs Scribe, or optional local Whisper (`POST /api/transcribe`). Raw voice is not sent to the narration provider.

---

## Architecture

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Web UI     │────▶│  API routes      │────▶│  orchestrator   │
│  (React)    │     │  (Next.js App)   │     │  kitchen/*      │
└─────────────┘     └────────┬─────────┘     └────────┬────────┘
                             │                        │
                    ┌────────┴────────┐    ┌──────────┴──────────┐
                    │ MongoDB Atlas   │    │ External services     │
                    │ (or .data JSON) │    │ Gemma, ElevenLabs,    │
                    └─────────────────┘    │ SerpApi, Backboard,   │
                                           │ TheMealDB, OFF, etc.  │
                                           └───────────────────────┘
```

### Propose pipeline (`startKitchenRun`)

| Step | Component | Description |
| --- | --- | --- |
| 1 | Mastra | Approval gate / suspend workflow when LibSQL storage is available |
| 2 | Memory | MongoDB pantry snippets + optional vector search; Backboard semantic hits |
| 3 | SerpApi | Substitute hints when pantry text implies missing items |
| 4 | TheMealDB | Public meal names as grounding (no API key) |
| 5 | Gemma | Primary recipe proposal (`response_format: json_object`) |
| 6 | Open Food Facts | Allergen tags and macro hints per ingredient |
| 7 | Gemma critic | Second pass; may rewrite recipe when review fails |
| 8 | Pantry review | Code-level in-pantry / missing / allergen blocks |
| 9 | TabPFN + heuristic | Blended friend-fit score (Python optional locally) |
| 10 | Gemma brief | Optional one-sentence summary for the cook |

Approve and narrate paths re-run pantry safety checks. Temporal may execute durable narration when `TEMPORAL_ADDRESS` is set and reachable; Render defaults to in-process narration (`TEMPORAL_NARRATE=false` in `render.yaml`).

Agent steps are wrapped with Sentry spans (`withAgentSpan`) when `SENTRY_DSN` is configured. Per-run step history is stored on the `KitchenRun.trace` array and exposed at `GET /api/runs/:id/trace`.

---

## Technology stack

| Area | Implementation |
| --- | --- |
| Runtime | Node.js 24, Next.js 16 (App Router), React 19 |
| LLM | OpenAI SDK → Ollama, Google AI Studio OpenAI-compat, or Groq (`GEMMA_*`) |
| Database | MongoDB Atlas (`house_pot` database); local JSON fallback under `.data/` |
| Embeddings | Ollama `nomic-embed-text`, or Google `text-embedding-004` when using AI Studio |
| Workflow | Mastra (`kitchen-workflow`, approval gate) |
| TTS / STT | ElevenLabs (narration after approve; Scribe optional) |
| Observability | Sentry; in-app integration probes (`GET /api/health`) |
| CI | GitHub Actions: test, build, lint; optional Render deploy hook |
| Hosting | Render (`render.yaml`), optional Docker image with Whisper |

---

## Repository layout

```text
src/
  app/api/           HTTP handlers (household, runs, health, transcribe, …)
  components/        HousePotApp, history, integrations dashboard
  lib/
    gemma.ts         LLM client, JSON extraction, kitchenChat helper
    kitchen/         orchestrator, pantry-check, critic, free-food, shopping
    db/              Mongo + local JSON store
    mastra/          Approval workflow
    durable/         Idempotent narration steps
    temporal/        Optional durable narration worker
scripts/             live-stack, smoke-production, temporal-worker
.github/workflows/   house-pot.yml, live-smoke.yml
render.yaml          Render Blueprint (free web service)
Dockerfile           Node + Python + Whisper (full-stack hosts)
```

Challenge submission narrative for DEV/Hacktoberfest lives in [`SUBMISSION.md`](./SUBMISSION.md), not in this document.

---

## Prerequisites

- Node.js 20+ (CI uses 24)
- npm
- For full local AI: [Ollama](https://ollama.com) with `gemma3:4b` and optionally `nomic-embed-text`
- Optional: Python 3 + `requirements.txt` (Whisper), `requirements-tabpfn.txt` (TabPFN)
- Optional: Docker Compose (`npm run stack:up`, `npm run temporal:up`)

---

## Configuration

Copy the template and set secrets locally (never commit `.env.local`):

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMMA_BASE_URL` | For real recipes | OpenAI-compatible root (e.g. `http://127.0.0.1:11434/v1`) |
| `GEMMA_API_KEY` | With hosted LLM | Provider API key (`ollama` for local Ollama) |
| `GEMMA_MODEL` | Recommended | Model id (e.g. `gemma3:4b`, `gemma-4-26b-a4b-it`, `gemini-3.8-flash` on AI Studio) |
| `MONGODB_URI` | Production | Atlas connection string; omit for `.data/house-pot.json` |
| `ELEVENLABS_API_KEY` | Narration | TTS after approval |
| `ELEVENLABS_VOICE_ID` | Optional | Voice selection |
| `NEXT_PUBLIC_APP_URL` | Production | Public origin (SEO, callbacks) |
| `SERPAPI_API_KEY` | Optional | Substitute and meal inspiration |
| `SENTRY_DSN` | Optional | Error and agent tracing |
| `TEMPORAL_ADDRESS` | Optional | Durable narration worker |
| `TEMPORAL_NARRATE` | Optional | Set `false` to force in-process narrate |
| `BACKBOARD_*`, `TIGER_DATABASE_URL` | Optional | Extended memory mirrors |

See `.env.example` for the full list and commented cloud examples.

---

## Local development

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The kitchen page stores `house-pot-household-id` in `localStorage`; history at `/history` lists runs for that household. Pass `?household=<uuid>` on `/history` to load another profile.

```bash
npm test          # unit tests (pantry-check, free-food, gemma JSON extract)
npm run lint
npm run build
npm run smoke:prod   # probes production /api/health (no secrets)
```

Full sponsor stack locally:

```bash
npm run stack:up      # Mongo, Ollama models, env hints
npm run temporal:up   # Temporal server
npm run temporal:worker
```

---

## HTTP API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Integration probe summary + `detail` object |
| `GET` | `/api/integrations` | Full integration status for the dashboard |
| `POST` | `/api/household` | Create/update cook profile |
| `GET` | `/api/household?id=` | Fetch household by id |
| `GET` | `/api/household/:id/runs` | List runs (`limit`, optional `runId`) |
| `GET` | `/api/household/:id/memories` | Pantry memory snippets |
| `POST` | `/api/runs` | Start propose pipeline (`householdId`, `pantryText`, `diners`) |
| `GET` | `/api/runs/:id` | Fetch run |
| `POST` | `/api/runs/:id/approve` | `{ approved, autoNarrate? }` |
| `POST` | `/api/runs/:id/narrate` | Generate narration audio |
| `POST` | `/api/runs/:id/feedback` | Persist cook feedback to memory |
| `GET` | `/api/runs/:id/trace` | Agent step trace |
| `GET` | `/api/runs/:id/entire` | Entire-compatible export payload |
| `POST` | `/api/transcribe` | Server-side Whisper (requires Python in image) |

Errors on approve/narrate return when pantry review marks allergens (`safeToNarrate: false`).

---

## Deployment (Render)

The Blueprint in `render.yaml` defines a free-tier Node web service: `npm install && npm run build`, `npm start`, health check `/api/health`.

1. Connect the GitHub repository in Render (Blueprint or manual Web Service).
2. Set environment variables from the configuration table (minimum: `MONGODB_URI`, `GEMMA_*`, `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_APP_URL`).
3. Atlas network access must allow Render egress (commonly `0.0.0.0/0` for demos).
4. Do not point `GEMMA_BASE_URL` at localhost on Render. Use a hosted OpenAI-compatible endpoint (Google AI Studio or Groq per `.env.example`).
5. Leave `TEMPORAL_ADDRESS` unset on free tier; `TEMPORAL_NARRATE` defaults to `false` in the Blueprint.

**Hosted LLM (typical):**

```env
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMMA_API_KEY=<AI Studio key>
GEMMA_MODEL=gemini-3.8-flash
```

See **[Local vs live](#local-vs-live)** for capability differences. For Whisper on a host, use the `Dockerfile` instead of the default Render Node blueprint.

---

## Continuous integration

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `house-pot.yml` | push/PR to `main` | `npm test` → `build` + `lint` → optional `RENDER_DEPLOY_HOOK` POST |
| `live-smoke.yml` | daily schedule, manual | `scripts/smoke-production.sh` against production health |

Add repository secret `RENDER_DEPLOY_HOOK` (Render deploy hook URL) to redeploy after a green `main` build. No GitHub secrets are required for CI or smoke tests.

---

## Data model

- **Household** — cook name, allergies, dislikes, cuisines, notes.
- **KitchenRun** — pantry text, status (`awaiting_approval` → `approved` → `narrated`), `proposal` recipe, `pantryReview`, `kitchenBrain` (external API artifacts), `trace`, optional `audioBase64`.
- **PantryMemory** — text snippets with tags; optional embedding vectors when embedding probe succeeds.

MongoDB uses database name `house_pot`. If `MONGODB_URI` is set but connection fails, the store falls back to local JSON to avoid hard 500s during misconfiguration.

---

## License

MIT
