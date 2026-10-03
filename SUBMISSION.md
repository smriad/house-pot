---
title: "House Pot: Amma's kitchen in Dhaka — approve first, then listen"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*Submission for [Hacktoberfest Weekend: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

**House Pot** is a small kitchen app I built for **Amma**—the one who runs our stove in Dhaka, turns whatever came back from the **bazar** into dinner, and still remembers that my cousin cannot touch **peanuts** or **shrimp** (we treat shellfish that way in the house). Open-weight **Gemma** suggests one recipe; **plain TypeScript** checks the pantry and allergies; **ElevenLabs** reads the steps only after she taps approve on *that* card.

## What I Built

In our flat, dinner is not a recipe from the internet. It is **masoor dal**, **bhat**, whatever **shaak** was cheap, a little **tel** and **jhol** if there is time, and always the question: *ke ke khabe, ar ke allergic?* Amma does not want a foreign “AI chef.” She wants: *ajke ranna-ta ki hobe, haate ja ache diye, allergy bhule na, ar chula dike mukho kore ekta pora wall of text na.*

She types the pantry in Banglish—`masoor dal, piyaz, roshun, chaal, jeera, palong shaak, doi`—or speaks it while the rice soaks. Gemma proposes **one** dish. The app then checks in **code**, not in the prompt:

- each line is **in the kitchen** or **not in the pantry** (lobon, pani, tel, morich staples do not count as “missing”)
- if anything matches an allergy—**chingri** for shellfish, **badam tel** for peanuts—the **Approve** button stays off
- **ElevenLabs** speaks only after she approves, and only the recipe text—never her voice note from the phone

**MongoDB Atlas** remembers the household: who cannot eat what, what we usually have after Sunday bazar, and what she said last week (“**kom jeera** next time”). So Tuesday’s dal is not explained from zero again.

**Real run from our kitchen (live smoke):** pantry = red lentils (masoor), onion, garlic, rice, cumin, spinach, yogurt; allergies = peanuts and shellfish; three diners. Gemma proposed **Mild Spinach and Red Lentil Dal with Rice**—a very Dhaka weeknight shape. Every ingredient matched what was on the card. Narration waited until approve.

## Demo

**Live:** https://house-pot.onrender.com/

No login—the browser saves one household id (see `/history?household=…` if you switch devices).

**Path for judges** (Render free tier: first load after sleep can take ~60 seconds):

1. Open the link; wait for the kitchen screen.
2. Cook name **Amma**; allergies **peanuts, shellfish** (or **badam, chingri** in the list).
3. Pantry example: `masoor dal, piyaz, roshun, chaal, jeera, palong shaak, doi` (English labels work too: red lentils, onion, garlic, rice, cumin, spinach, yogurt).
4. Tap **Propose tonight's pot**; read which items are marked in-kitchen vs missing.
5. Tap **Approve & read aloud** only when the card is safe; audio runs after that gate.

If approve is disabled, the card shows why—missing bazar item or allergen. That is the product.

Skeptics: `src/lib/kitchen/pantry-check.ts` owns the marks; approve and narrate re-run the same logic so an old “haan” cannot read aloud a recipe that now includes shrimp.

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
| **Gemma** | Proposes the recipe. **Local (Bangladesh dev machine):** `gemma3:4b` on Ollama—weights on hardware we control. **Live demo:** same client, hosted endpoint so a judge on mobile data does not install Ollama first. |
| **Pantry check** | Deterministic safety—the model does not get to declare “allergy safe.” |
| **MongoDB Atlas** | Household, pantry memory, run history, Amma’s feedback after dinner. |
| **Mastra** | Workflow suspend on approval when LibSQL is up; UI gate still applies if Mastra is off. |
| **ElevenLabs** | Bangla-accent-friendly TTS on approved text; idempotent narrate on retry. |
| **Render** | `render.yaml` — public demo for the challenge. |

```text
bazar / pantry text (Banglish OK)
  → MongoDB memory
  → Gemma proposes one recipe
  → code marks pantry + blocks allergens
  → Amma approves that exact card
  → ElevenLabs narrates that text
```

The approve button only makes sense when the card shows what is in the **trolley and the tiffin box**—not a black-box “trust me.” That is human-in-the-loop without rubber-stamping.

Locally you can also run Whisper for pantry dictation, TabPFN for a friend-fit score, Temporal for durable narration, and Sentry on agent steps—`GET /api/health` shows what is live in Dhaka vs on Render.

## Why Does Open Innovation Matter?

In a Dhaka household the sensitive data is not “inspiration.” It is **who has asthma around peanuts**, what **Amma actually bought** before the rain, and what we **cannot** send to a US meal API.

Open-weight **Gemma** can plan on a machine we run—laptop, small server, or a GPU droplet if we outgrow Ollama. The validation logic stays ours. The Render link uses hosted inference so judges anywhere can click; I would rather say that plainly than pretend the demo box is offline-only.

**ElevenLabs** is the closed piece, and it sits **behind** approve—it never sees the voice note, only the recipe she accepted.

MongoDB holds what she would otherwise repeat at every **iftar** or Sunday lunch: allergies, pantry habits, “**ektu kom lonka**.”

## Prize Categories

- **Best Use of Gemma** — dinner from the pantry + constraints; structured JSON recipe.
- **Best Use of ElevenLabs** — narration only after approve; not before.
- **Best Use of MongoDB Atlas** — household memory across nights in Dhaka and on the live URL.
- **Best Use of Render** — https://house-pot.onrender.com/ from `render.yaml`.

## My Agent Session

{% agent_session 413 %}

Session on DEV: [Building House Pot (curated transcript)](https://dev.to/agent_sessions/building-house-pot-pantry-checks-in-code-approve-before-narrate-hacktoberfest-submission-7va28o)

## Friend quote

> *“Dal-ta thik chilo—parer bar ektu kom jeera. Ar approve chara awaz ta shunbo na.”*  
> — Amma, after the first real dinner from House Pot.

---

*Built for Hacktoberfest Weekend 2026 — Build for a Friend, from a Bangladesh kitchen.*
