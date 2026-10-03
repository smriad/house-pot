# House Pot

**Build for a Friend** — Hacktoberfest Weekend Challenge entry.

Phone-friendly web app for the household cook: pantry in → **open-weight Gemma** recipe out → human **approve** → **ElevenLabs** reads steps aloud.

## Integrations

| Sponsor / OSS | Status in app |
| --- | --- |
| **Gemma** | Two passes: draft, then a critic that can rewrite (`GEMMA_*`) |
| **TheMealDB** | Free public dish names, no key, fed into the planner |
| **Open Food Facts** | Free allergen tags and protein per 100g, no key |
| **Whisper** | Optional server transcription (`POST /api/transcribe`, `scripts/transcribe.py`) |
| **MongoDB Atlas** | Household + pantry + friend feedback memory |
| **Mastra** | Suspend/approve workflow (`@mastra/libsql` + `kitchen-workflow`) |
| **ElevenLabs** | Post-approval narration only |
| **SerpApi** | Substitute hints when pantry mentions missing items |
| **Sentry** | Agent spans on each orchestration step (`withAgentSpan`) |
| **Render** | `render.yaml` + `Dockerfile` (standalone Next output) |

Durable narration uses **idempotent steps** (`lib/durable/steps.ts`) so retries do not double-charge ElevenLabs.

### Intelligence stack (free / open)

| Layer | Service | Cost |
| --- | --- | --- |
| **Planner + critic + cook brief** | Gemma / Gemini via `GEMMA_*` OpenAI-compatible API | AI Studio free tier |
| **Meal grounding** | [TheMealDB](https://www.themealdb.com/) | No key |
| **Allergen + macros** | [Open Food Facts](https://world.openfoodfacts.org/) | No key |
| **Friend-fit score** | Heuristic + optional [TabPFN](https://github.com/PriorLabs/TabPFN) (local Python) | OSS |
| **Pantry memory** | MongoDB + optional vectors (`text-embedding-004` on AI Studio or Ollama `nomic-embed-text`) | Atlas M0 |
| **Substitutes / ideas** | SerpApi (optional) | Hacktoberfest promos |
| **Voice** | ElevenLabs TTS + Scribe | Sponsor key |

### CI/CD (GitHub Actions, free)

- **`house-pot.yml`** — `npm test` → `build` → `lint` on every push/PR.
- **`live-smoke.yml`** — daily + manual curl of `/api/health` on production (`npm run smoke:prod`).
- **Render auto-deploy** — in Render: Settings → Deploy Hook → add URL as repo secret `RENDER_DEPLOY_HOOK` to redeploy on green `main` builds.

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

**Google AI Studio (recommended for Render — real Gemma 3)**

Groq [retired `gemma2-9b-it`](https://console.groq.com/docs/deprecations) (Oct 2025). For the Gemma prize track, use hosted **Gemma** via AI Studio:

1. API key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. In Render → **Environment**:

| Variable | Value |
| --- | --- |
| `GEMMA_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `GEMMA_API_KEY` | your AI Studio key |
| `GEMMA_MODEL` | `gemini-3.8-flash` for OpenAI-compat chat on AI Studio |

Gemma 4 IDs (`gemma-4-4b-it`, etc.) may **404** on the OpenAI shim — use **Ollama** (`gemma3:4b`) for true Gemma locally and `gemini-2.5-flash` on Render for the live demo, or Groq below.

If propose returns 400 about JSON mode, self-host Ollama (`gemma3:4b`).

**Groq (fast OpenAI-compatible, not Gemma)**

Use only if you accept a non-Gemma model on the live demo (e.g. `openai/gpt-oss-20b` per [Groq deprecations](https://console.groq.com/docs/deprecations)):

| Variable | Value |
| --- | --- |
| `GEMMA_BASE_URL` | `https://api.groq.com/openai/v1` |
| `GEMMA_API_KEY` | `gsk_...` |
| `GEMMA_MODEL` | `openai/gpt-oss-20b` |

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

## Hacktoberfest submission (DEV)

**Challenge:** [Hacktoberfest Weekend — Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)  
**Canonical draft:** [`SUBMISSION.md`](./SUBMISSION.md) (copy into DEV when ready)

### Before you publish

- [ ] Live demo works: https://house-pot.onrender.com/ (wake Render if cold; first load can take ~1 min)
- [ ] Short screen recording: pantry → propose → **Approve** → narrate (30–60s)
- [ ] Public repo: https://github.com/smriad/house-pot
- [ ] DEV post tags: `devchallenge`, `weekendchallenge`, `hf26challenge`
- [ ] AI disclosure on DEV if you used AI to write the post ([DEV AI guidelines](https://dev.to/p/devteam/ai-content-policy-update-4g2d))
- [ ] Friend quote after one real dinner (replace the placeholder in the template below)

### Copy-paste template (DEV editor)

Use this structure on DEV. Replace `TODO_*` and add your video embed.

```markdown
---
title: "House Pot: dinner from the pantry, read aloud only after Amma approves"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*Submission for [Hacktoberfest Weekend: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

Amma is the person in our household who turns whatever is in the kitchen into dinner — without a recipe, and with one eye on who cannot eat peanuts or shellfish.

**House Pot** answers: *what can we make with what we have, without forgetting the allergy, and without reading a wall of text while the rice burns?*

She types or speaks the pantry. **Gemma** (open weights locally; hosted API on Render) proposes one recipe. The app checks safety in **code** (`pantry-check.ts`): ingredients marked in-kitchen vs missing; allergens block **Approve**. **ElevenLabs** reads steps only after she taps approve — recipe text only, never the voice note. **MongoDB Atlas** remembers household, pantry, and feedback.

## Demo

- **Live:** https://house-pot.onrender.com/
- **Video:** TODO_DEMO_VIDEO_URL
- **Try it:** propose a pot → read the card → **Approve & read aloud**

## Code

https://github.com/smriad/house-pot

| Path | Role |
| --- | --- |
| `src/lib/gemma.ts` | OpenAI-compatible JSON recipes + critic/brief |
| `src/lib/kitchen/pantry-check.ts` | Pantry match + allergy gate |
| `src/lib/kitchen/orchestrator.ts` | Propose → check → approve → narrate |
| `src/lib/mastra/kitchen-workflow.ts` | Approval suspend when Mastra storage is up |
| `src/components/HousePotApp.tsx` | Mobile-first kitchen UI |

## How I Built It

| Layer | Choice |
| --- | --- |
| **Gemma** | Meal planning; local `gemma3:4b` (Ollama) or Gemma/Gemini via AI Studio on Render (`GEMMA_*`) |
| **Pantry safety** | Deterministic checks + Open Food Facts allergen tags |
| **MongoDB Atlas** | Household + run history + pantry memory |
| **Mastra** | Human-in-the-loop approval workflow |
| **ElevenLabs** | Post-approval narration (idempotent narrate step) |
| **Render** | `render.yaml`, `/api/health`, GitHub Actions smoke |

```text
pantry → memory (Mongo) → Gemma propose → code pantry/allergy check
  → cook approves → ElevenLabs narrates approved text only
```

## Why Does Open Innovation Matter?

Allergies and what is actually at home are the sensitive inputs. Open-weight **Gemma** can run on hardware we control; the hosted demo uses the same client against a cloud endpoint so judges can try the flow from a phone. **ElevenLabs** is deliberately behind the approval gate — closed voice, minimal cloud touch.

## Prize categories

- **Best Use of Gemma** — structured recipes from pantry + constraints
- **Best Use of MongoDB Atlas** — household and pantry memory across runs
- **Best Use of ElevenLabs** — narration only after explicit approve
- **Best Use of Render** — production URL above + CI deploy hook (optional `RENDER_DEPLOY_HOOK`)

## Friend quote

> TODO_FRIEND_QUOTE — one sentence from Amma after trying a real dinner.

---

*Built for Hacktoberfest Weekend 2026 — Build for a Friend.*
```

### Enter on DEV

1. Open the [challenge page](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01) and **Submit** / link your post when published.
2. Keep `SUBMISSION.md` in sync with the live post for reviewers cloning the repo.

## License

MIT
