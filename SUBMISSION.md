---
title: "House Pot: dinner from the pantry, read aloud only after Amma approves"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

Amma is the person in our household who turns whatever is in the kitchen into dinner. She does it without a recipe, and with one eye on who cannot eat peanuts or shellfish.

She does not want an AI chef. She wants an answer to a smaller question: *what can I make with what we have, without forgetting the allergy, and without reading a wall of text while the rice burns?*

**House Pot** is that answer.

She types the pantry, or speaks it. An open-weight **Gemma** model proposes one recipe. The app then checks that recipe in code, not in the prompt:

- each ingredient is marked **in the kitchen** or **not in the pantry** (salt, water, oil, and pepper count as staples)
- if an ingredient or a substitute matches an allergy, including shrimp for shellfish and peanut oil for peanuts, **Approve** stays off
- **ElevenLabs** reads the steps only after she taps approve, and it receives the recipe text, never the voice note

MongoDB remembers the household, the pantry, and what she said afterward, so Tuesday's lentils are not a new explanation every week.

One run from that kitchen. Pantry: red lentils, onion, garlic, rice, cumin, spinach, yogurt. Allergies: peanuts and shellfish. Gemma proposed **Red Lentil Dal with Spinach**. The check found every ingredient already in the kitchen. The read-aloud button waited for her.

## Demo

**Live:** https://house-pot.onrender.com/

Propose a pot, read the recipe, tap **Approve & read aloud**. That hosted demo is the path a judge can try without installing anything: Gemma, the approval, then ElevenLabs. The first load on Render's free tier can take a minute.

The ingredient marks and the allergy block live in `src/lib/kitchen/pantry-check.ts`. Narration is refused again on the server when she approves and again when the audio is requested. An earlier yes cannot speak a recipe that now includes an allergen.

## Code

https://github.com/smriad/house-pot

- `src/lib/gemma.ts` — Gemma, through an OpenAI-compatible JSON recipe
- `src/lib/kitchen/pantry-check.ts` — pantry match and allergy block
- `src/lib/kitchen/orchestrator.ts` — propose, check, approve, narrate
- `src/lib/mastra/kitchen-workflow.ts` — approval suspends here when Mastra storage is up
- `src/components/HousePotApp.tsx` — the kitchen

## How I Built It

| Layer | What it does |
| --- | --- |
| Gemma | Proposes the recipe. Locally that is `gemma3:4b` on Ollama. The Render demo uses the same client, so a judge can try the approve path without pulling weights. |
| Pantry check | Plain code. It does not ask the model whether the recipe is safe. |
| MongoDB Atlas | Household, pantry notes, and her feedback. |
| Mastra | Suspends the workflow on approval when its storage is available. The button is the gate either way. |
| ElevenLabs | Speaks the approved recipe only. The narrate step is idempotent, so a retry does not call it again for the same run. |
| Render | `render.yaml`. The live app is the link above. |

```text
pantry text
  → MongoDB memory
  → Gemma proposes a recipe
  → code marks what is in the kitchen and blocks allergens
  → Amma taps Approve on that recipe
  → ElevenLabs narrates that text
```

The check runs again at approve time and again when audio is requested. The yes belongs to that ingredient list. If the list would now include an allergen, the old yes does not count. [Hiroshi Takamura's note on tying approval to the exact version an agent delivered](https://dev.to/hiroshi_takamura_c851fe71/tie-human-approval-to-the-exact-version-an-ai-agent-delivered-b6e) is the same rule, applied here to a recipe instead of a code review.

A prompt that says "never use peanuts" is not the control. The control is a function that reads the ingredients and turns the button off. An approve button with nothing on it to inspect becomes a rubber stamp, which is the failure [the approval queue pattern](https://dev.to/draganristicrsjpg/the-approval-queue-pattern-putting-a-human-in-the-loop-without-putting-them-in-the-way-3ldl) warns about. The card shows what is in the kitchen, and what would be unsafe to read aloud, before the tap does anything.

## Why Does Open Innovation Matter?

The sensitive parts are the allergy list and what is actually in the house.

A closed meal API wants both on a server we do not run. Gemma on Ollama can plan the meal on a machine we control, and the weights can be swapped without rewriting the kitchen. The hosted demo uses a hosted endpoint for a practical reason: a judge opening the link from a phone cannot install Ollama first. I would rather say that than claim the Render box is offline.

ElevenLabs is the closed piece, and it is the piece behind the gate. It does not receive the voice note. It receives the recipe she already accepted.

MongoDB holds the memory she would otherwise repeat: allergies, the pantry, and whether last Thursday was too spicy.

## Prize categories

- **Best Use of Gemma** — the meal is the product. Gemma writes the recipe from the pantry and the constraints.
- **Best Use of ElevenLabs** — narration is the action that leaves the house, and it does not run before approval.
- **Best Use of MongoDB Atlas** — the household, the pantry, and her feedback persist across nights.
- **Best Use of Render** — the demo above is the `render.yaml` service.

The sentence still missing from this post is hers, after one dinner. The app will not read the pot aloud until she gives it.
