---
title: "House Pot: Amma's kitchen in Dhaka — approve first, then listen"
published: true
dev_url: https://dev.to/smriad/house-pot-ammas-kitchen-in-dhaka-approve-first-then-listen-2mi9
tags: devchallenge, weekendchallenge, hf26challenge
---

*Submission for [Hacktoberfest Weekend: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)* — `#hf26challenge`

**House Pot** is a kitchen app for **Amma** in Dhaka: **one** recipe from tonight’s pantry, allergies enforced in code, **ElevenLabs** only after she taps **Approve & read aloud**.

## The problem

Weeknight dinner in our flat is not “pick a trending recipe.” It is **what came back from the market**, who is eating, and **who cannot eat peanuts or shellfish**. That breaks down when:

- the pantry is **fixed for tonight** (dal, rice, greens—whatever was affordable)
- **allergy mistakes are not acceptable** (a cousin’s peanut reaction is not a disclaimer)
- the cook wants **one answer**, not ten options and a wall of text
- **voice is welcome**, but only after she has accepted the exact dish on screen

**Amma** runs our stove in Dhaka—habit, memory, and the household allergy list in her head. House Pot is for her and anyone in the same setup: real constraints, **approve-before-you-listen**.

Defaults: cook **Amma**, allergies **peanuts** and **shellfish**, pantry `red lentils, onion, garlic, rice, cumin, spinach, yogurt`.

## How I'm solving it

| Piece | What it does |
| --- | --- |
| **Gemma** | One structured JSON recipe from pantry + allergies (optional critic pass) |
| **`pantry-check.ts`** | In-kitchen vs missing; **blocks approve** on allergens—not “the model said it’s fine” |
| **ElevenLabs** | TTS only on the **approved** card; approve/narrate **re-run** the same checks |
| **MongoDB Atlas** | Household, runs, feedback (“less cumin next time”) |
| **Whisper** (local) | Pantry dictation; narration never reads the raw voice note |

**Design:** plan (Gemma) → policy (`pantry-check`) → deliver (TTS gated on approve). BRD, C4, and full tech tables: [README](https://github.com/smriad/house-pot).

**Smoke run:** Gemma proposed **Mild Spinach and Red Lentil Dal with Rice**; every ingredient matched the pantry; audio waited for approve.

## Architecture

Next.js on **Render** (public demo) · **Gemma** (Ollama locally, hosted `GEMMA_*` on Render) · **MongoDB** · deterministic **`pantry-check`** · **ElevenLabs** after approve · **Mastra** approval gate · optional **Temporal** narrate when a worker is up.

```mermaid
sequenceDiagram
  participant U as Browser
  participant API as Next.js
  participant G as Gemma
  participant P as pantry-check
  participant E as ElevenLabs
  U->>API: POST /api/runs
  API->>G: propose JSON
  API->>P: review allergies
  API-->>U: recipe card
  U->>API: approve then narrate
  API->>P: re-check
  API->>E: TTS approved text only
```

Same repo locally and live: my laptop runs Whisper, TabPFN, Temporal, Backboard/Tiger mirrors—see `GET /api/health`. Render turns off heavy Python paths so judges can click without Ollama.

## Demo

**Live:** https://house-pot.onrender.com/

<video src="https://house-pot.onrender.com/demo.mp4" controls width="100%" title="House Pot demo — technology tour and approved recipe narration"></video>

[~5 min tour](https://house-pot.onrender.com/demo.mp4) · [Amma narrated run](https://house-pot.onrender.com/?run=bdb0308d-d198-4ef1-891f-bad4dc7aa50b) · [all pots (3)](https://house-pot.onrender.com/history/all)

**Judges:** open the live URL (cold start on free tier ~60s). Keep **Amma**, allergies **peanuts, shellfish**, the pantry line above, tap **Propose tonight's pot**, then **Approve & read aloud** only when marks look safe. Disabled approve shows why—that is the product.

## Code

https://github.com/smriad/house-pot — `pantry-check.ts` (system of record), `orchestrator.ts`, `gemma.ts`, `store.ts`, `HousePotApp.tsx`, `render.yaml`.

**Stack in one line:** Gemma plans · code enforces pantry + allergens · MongoDB remembers · ElevenLabs speaks after approve · Playwright recorded `demo.mp4`. Per-sponsor how/why tables and production `/api/health` notes are in the README.

## Why Does Open Innovation Matter?

In a Dhaka household the sensitive data is not “inspiration.” It is **who reacts to peanuts**, what **Amma bought** before the monsoon rain, and what we **cannot** ship to a closed meal API abroad.

Open-weight **Gemma** can plan on a machine we run; validation stays ours. The Render demo uses hosted inference so judges anywhere can try it—I say that plainly rather than pretending the box is offline-only.

**ElevenLabs** is the closed piece, and it sits **behind** approve—it never sees the pantry voice note, only the recipe she accepted. MongoDB holds allergies, habits, and “a little less chili next time” so family lunch is not a repeat lecture.

## Prize Categories

- **Best Use of Gemma** — one pantry-constrained JSON recipe per night.
- **Best Use of ElevenLabs** — narration only after approve.
- **Best Use of MongoDB Atlas** — household memory on the live URL.
- **Best Use of Render** — https://house-pot.onrender.com/ from `render.yaml`.

## My Agent Sessions

{% agent_session 422 %}

[Build log — demo video, voiceover, submission sync](https://dev.to/agent_sessions/house-pot-demo-video-tech-voiceover-and-dev-submission-sync-xuczlj) (session **422**; make **Public** on DEV for the embed).

## Friend quote

> “The dal was right—use a little less cumin next time. And I will not listen to the voice until I tap approve.”  
> — Amma

---

*Hacktoberfest Weekend 2026 — Build for a Friend.*
