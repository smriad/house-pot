---
title: "House Pot: Amma's kitchen in Dhaka — approve first, then listen"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*Submission for [Hacktoberfest Weekend: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

**House Pot** is a small kitchen app I built for **Amma**—the one who runs our stove in Dhaka, cooks from whatever came back from the **market**, and still remembers that my cousin cannot eat **peanuts** or **shrimp** (how we handle shellfish at home). Open-weight **Gemma** suggests one recipe; **plain TypeScript** checks the pantry and allergies; **ElevenLabs** reads the steps only after she taps approve on *that* card.

## What I Built

In our flat, dinner is not a trending recipe. It is **red lentil dal**, **rice**, whatever **greens** were affordable that day, a simple **curry** if there is time, and always the question: *who is eating tonight, and who is allergic to what?* Amma does not want a foreign “AI chef.” She wants: *what can I cook with what we already have, without forgetting an allergy, and without staring at a wall of text while the rice is on the stove?*

She types the pantry in plain English—`red lentils, onion, garlic, rice, cumin, spinach, yogurt`—or speaks it while the rice soaks. Gemma proposes **one** dish. The app then checks in **code**, not in the prompt:

- each line is **in the kitchen** or **not in the pantry** (salt, water, oil, and pepper count as staples)
- if anything matches an allergy—shrimp for shellfish, peanut oil for peanuts—the **Approve** button stays off
- **ElevenLabs** speaks only after she approves, and only the recipe text—never her voice note from the phone

**MongoDB Atlas** remembers the household: who cannot eat what, what we usually have after the Sunday market run, and what she said last week (“use less cumin next time”). So Tuesday’s dal is not explained from zero again.

**Real run from our kitchen (live smoke):** pantry = red lentils, onion, garlic, rice, cumin, spinach, yogurt; allergies = peanuts and shellfish; three diners. Gemma proposed **Mild Spinach and Red Lentil Dal with Rice**—a typical Dhaka weeknight. Every ingredient matched what was on the card. Narration waited until approve.

## Demo

**Live:** https://house-pot.onrender.com/

No login—the browser saves one household id (see `/history?household=…` if you switch devices).

**Path for judges** (Render free tier: first load after sleep can take ~60 seconds):

1. Open the link; wait for the kitchen screen.
2. Cook name **Amma**; allergies **peanuts, shellfish**.
3. Pantry example: `red lentils, onion, garlic, rice, cumin, spinach, yogurt`.
4. Tap **Propose tonight's pot**; read which items are marked in-kitchen vs missing.
5. Tap **Approve & read aloud** only when the card is safe; audio runs after that gate.

If approve is disabled, the card shows why—a missing market item or an allergen. That is the product.

Skeptics: `src/lib/kitchen/pantry-check.ts` owns the marks; approve and narrate re-run the same logic so an old “yes” cannot read aloud a recipe that now includes shrimp.

## Code

https://github.com/smriad/house-pot

| Path | Role |
| --- | --- |
| `src/lib/gemma.ts` | OpenAI-compatible JSON recipe from Gemma |
| `src/lib/kitchen/pantry-check.ts` | Pantry match + allergy block |
| `src/lib/kitchen/orchestrator.ts` | Propose → check → approve → narrate |
| `src/lib/mastra/kitchen-workflow.ts` | Approval suspend when Mastra storage is up |
| `src/components/HousePotApp.tsx` | Kitchen UI |

## How I Built It

| Layer | What it does |
| --- | --- |
| **Gemma** | Proposes the recipe. **Local (Bangladesh):** `gemma3:4b` on Ollama—weights on hardware we control. **Live demo:** same client, hosted endpoint so a judge on mobile data does not install Ollama first. |
| **Pantry check** | Deterministic safety—the model does not get to declare “allergy safe.” |
| **MongoDB Atlas** | Household, pantry memory, run history, Amma’s feedback after dinner. |
| **Mastra** | Workflow suspend on approval when LibSQL is up; UI gate still applies if Mastra is off. |
| **ElevenLabs** | Reads approved steps aloud; idempotent narrate on retry. |
| **Render** | `render.yaml` — public demo for the challenge. |

```text
market / pantry text (English)
  → MongoDB memory
  → Gemma proposes one recipe
  → code marks pantry + blocks allergens
  → Amma approves that exact card
  → ElevenLabs narrates that text
```

The approve button only makes sense when the card shows what is in the **shopping bag and the kitchen shelves**—not a black-box “trust me.” That is human-in-the-loop without rubber-stamping.

Locally you can also run Whisper for pantry dictation, TabPFN for a friend-fit score, Temporal for durable narration, and Sentry on agent steps—`GET /api/health` shows what is live at home in Dhaka vs on Render.

## Why Does Open Innovation Matter?

In a Dhaka household the sensitive data is not “inspiration.” It is **who reacts to peanuts**, what **Amma actually bought** before the monsoon rain, and what we **cannot** send to a closed meal API abroad.

Open-weight **Gemma** can plan on a machine we run—laptop, small server, or a GPU droplet if we outgrow Ollama. The validation logic stays ours. The Render link uses hosted inference so judges anywhere can click; I would rather say that plainly than pretend the demo box is offline-only.

**ElevenLabs** is the closed piece, and it sits **behind** approve—it never sees the voice note, only the recipe she accepted.

MongoDB holds what she would otherwise repeat at every family lunch: allergies, pantry habits, “a little less chili next time.”

## Prize Categories

- **Best Use of Gemma** — dinner from the pantry + constraints; structured JSON recipe.
- **Best Use of ElevenLabs** — narration only after approve; not before.
- **Best Use of MongoDB Atlas** — household memory across nights in Dhaka and on the live URL.
- **Best Use of Render** — https://house-pot.onrender.com/ from `render.yaml`.

## My Agent Session

{% agent_session 413 %}

Session on DEV: [Building House Pot (curated transcript)](https://dev.to/agent_sessions/building-house-pot-pantry-checks-in-code-approve-before-narrate-hacktoberfest-submission-7va28o)

## Friend quote

> “The dal was right—use a little less cumin next time. And I will not listen to the voice until I tap approve.”  
> — Amma, after the first real dinner from House Pot.

---

*Built for Hacktoberfest Weekend 2026 — Build for a Friend, from a Bangladesh kitchen.*
