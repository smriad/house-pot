---
title: "House Pot: Open-Weight Dinner Planning for the Friend Who Cooks"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

**House Pot** is a small web app for **Amma** — the person in our household who turns whatever is in the kitchen into dinner, usually without a recipe and always with one eye on who cannot eat what.

She does not want another “AI chef” that uploads a voice memo to someone else’s cloud. She wants: *what can I make with what we have, without forgetting the peanut allergy, and without me reading a wall of text while the rice burns.*

House Pot lets her:

1. Type or speak what is in the pantry (browser speech stays on-device until she submits).
2. Get a structured recipe from an **open-weight Gemma** model on an endpoint she controls (Ollama locally or a GPU droplet).
3. **Approve** the plan before anything is read aloud.
4. Hear the steps via **ElevenLabs** — only the approved recipe text, never the raw voice note.

Pantry history and allergies persist in **MongoDB Atlas** so “we always have lentils on Tuesdays” is not re-explained every night.

## Demo

<!-- Replace before publish -->
- **Live:** https://house-pot.onrender.com/
- **Local:** `npm run dev` → http://localhost:3000

Short screen recording: propose → approve → narrate (30–60s). Judges need to see Amma tap approve.

## Code

<!-- After push, embed repo on DEV or use: -->
`https://github.com/smriad/house-pot`

Key paths:

- `src/lib/gemma.ts` — Gemma via OpenAI-compatible API, JSON recipe schema
- `src/lib/kitchen/orchestrator.ts` — propose → approve → narrate pipeline with step trace
- `src/lib/mastra/kitchen-workflow.ts` — Mastra suspend/approve workflow pattern
- `src/components/HousePotApp.tsx` — mobile-first UI

## How I Built It

| Layer | Choice |
| --- | --- |
| Open-weight AI | **Gemma** (`gemma3:4b` through Ollama or vLLM) plans ingredients + steps |
| Agent shape | **Mastra** workflow for human-in-the-loop approve |
| Memory | **MongoDB Atlas** household + pantry snippets (local JSON fallback in dev) |
| Voice out | **ElevenLabs** TTS after approval |
| Optional | **SerpApi** when pantry text mentions missing items |
| Host | **Next.js** on **Render** (`render.yaml`) |

Flow:

```
pantry text (+ optional browser speech)
  → memory search (Atlas)
  → Gemma proposes Recipe JSON
  → cook taps Approve
  → ElevenLabs narrates approved text only
```

I kept narration behind approval on purpose: closed APIs are fine for *output* once the sensitive input has already been processed on open infrastructure.

## Why Does Open Innovation Matter?

For Amma, the sensitive parts are **allergies** and **what we actually have at home** — not generic meal inspiration.

A closed meal API wants her pantry and constraints on their servers. With Gemma on hardware we control:

- The model weights are inspectable and swappable (smaller quant on a laptop, larger on a droplet).
- Nothing about dinner planning *requires* sending voice or health constraints to a proprietary chef model.
- ElevenLabs only sees the recipe she already approved — a deliberate, minimal cloud touch.

That is the trade I wanted to show: **open-weight core, closed voice only where it clearly helps.**

## My Agent Session

<!-- After DevRelay submit_agent_session, replace slug: -->
{% agent_session TODO_SESSION_SLUG %}

Built with Cursor + DevRelay during Hacktoberfest setup (MLH login, challenge rules, ElevenLabs perk).

## Prize Categories

Entering:

- **Best Use of Gemma** — meal planning is the entire product; Gemma outputs structured recipes from pantry + allergies.
- **Best Use of MongoDB Atlas** — household profile and pantry memory across runs.
- **Best Use of ElevenLabs** — post-approval recipe narration.
- **Best Use of Render** — production deploy target (`render.yaml`).
- **Best Use of Entire** — agent session embedded above (process evidence for judges).

Not claiming this weekend: Arduino, TabPFN, Tinker (no fine-tune dataset yet), Temporal/Sentry (trace JSON in-app; full integration queued).

---

*Thanks for participating!*
