---
title: "House Pot: Amma's kitchen in Dhaka — approve first, then listen"
published: true
dev_url: https://dev.to/smriad/house-pot-ammas-kitchen-in-dhaka-approve-first-then-listen-2mi9
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

> “The dal was right—use a little less cumin next time. And I will not listen to the voice until I tap approve.”
> — Amma

## What I Built

**House Pot** is one weeknight dinner for **Amma**, who runs the stove in our Dhaka flat.

The pantry is whatever came back from the market. A cousin cannot eat peanuts or shellfish. She wants **one dish**, not a feed. Voice is welcome **after** she has accepted the exact card on screen — not before, and not as a disclaimer the model wrote.

So the app does three jobs, in that order:

1. **Gemma** proposes one JSON recipe from tonight’s pantry and the household allergy list.
2. **`pantry-check.ts`** marks in-kitchen vs missing and **blocks Approve** on allergens. Shrimp counts as shellfish. The model does not get a vote.
3. **ElevenLabs** reads the approved card aloud. It never sees the pantry voice note.

Defaults on the live site: cook Amma, allergies peanuts and shellfish, pantry `red lentils, onion, garlic, rice, cumin, spinach, yogurt`.

I handed her the dal. She ate it. The quote above is the spec.

## Demo

**Live:** https://house-pot.onrender.com/ (free-tier cold start ~60s)

**Sixty seconds:** leave the defaults → **Propose tonight’s pot** → read the marks → **Approve & read aloud**. Then tap **If shrimp slipped in**. That last click does not call Gemma or ElevenLabs. It adds shrimp to the same card and runs `pantry-check.ts` so you can see Approve stay off.

The live narrated card is **Mild Eggplant and Potato Comfort Curry** — Sunday-market eggplant, potato, eggs, mustard oil; four diners; peanuts and shellfish blocked. Gemma ~51s, critic ~23s, then ElevenLabs after approve.

[Amma’s narrated run](https://house-pot.onrender.com/?run=8073cda3-1865-4542-871b-5cba6afc9b4d) · [all pots](https://house-pot.onrender.com/history/all) · [video](https://house-pot.onrender.com/demo.mp4)

<video src="https://house-pot.onrender.com/demo.mp4" controls width="100%" title="House Pot — kitchen walkthrough"></video>

<details>
<summary>Live stills (same order as the video)</summary>

![Kitchen hero](https://house-pot.onrender.com/demo-screenshots/01-kitchen-top.png)

![Sunday-market pantry](https://house-pot.onrender.com/demo-screenshots/02-kitchen-form.png)

![Shrimp-slip gate + ElevenLabs](https://house-pot.onrender.com/demo-screenshots/03-approved-recipe.png)

![Kitchen services](https://house-pot.onrender.com/demo-screenshots/04-integrations-dashboard.png)

![All pots](https://house-pot.onrender.com/demo-screenshots/05-history-all.png)

![Amma household history](https://house-pot.onrender.com/demo-screenshots/06-household-history.png)

</details>

## Code

{% embed https://github.com/smriad/house-pot %}

Start at `pantry-check.ts`, then `orchestrator.ts`, `approve/route.ts`, `narrate/route.ts`, `HousePotApp.tsx`.

## How I Built It

Open-weight **Gemma** is good at a dal from lentils and spinach. It is not a doctor. Competitors in this challenge put allergies in the prompt and hope. I put them in TypeScript and **re-run the same check on approve and on narrate**, so a stale “yes” cannot speak a changed ingredient list.

The human gate is one executable action: *speak this recipe*. Not a transcript. Not “the model said it was fine.” [The approval-queue pattern](https://dev.to/draganristicrsjpg/the-approval-queue-pattern-putting-a-human-in-the-loop-without-putting-them-in-the-way-3ldl) is spend the human only where the action is irreversible; [tie approval to the exact artifact](https://dev.to/hiroshi_takamura_c851fe71/tie-human-approval-to-the-exact-version-an-ai-agent-delivered-b6e) so “approved” cannot drift. House Pot binds approve to **this** `proposal` and **this** `pantryReview`.

ElevenLabs is the closed piece on purpose. It sits **behind** the gate and receives **recipe text only**. MongoDB keeps the household, the run, and “less cumin next time” so tomorrow’s propose is not a lecture.

Locally, the same repo talks to Ollama (`gemma3:4b`), Whisper, and optional TabPFN. Render uses hosted `GEMMA_*` so a judge on a phone can click without installing anything. I say that plainly rather than pretending the public URL is air-gapped.

## Why Does Open Innovation Matter?

In this kitchen the sensitive data is not “inspiration.” It is **who reacts to peanuts**, what Amma bought before the rain, and what we will not ship to a closed meal API abroad.

Open-weight Gemma can plan on a machine we run. Validation stays in our repo. The Render demo is hosted so you can try it — the policy layer is still the TypeScript you can read. Swapping the planner is an env var; swapping the allergen rules is a pull request.

## My Agent Session

Three public sessions on DEV, oldest first.

### Demo video, tech voiceover, and DEV submission sync

{% agent_session 422 %}

[Session 422](https://dev.to/agent_sessions/house-pot-demo-video-tech-voiceover-and-dev-submission-sync-xuczlj) — 7 curated turns.

### Full HF26 build log (demo, ML, submission sync)

{% agent_session 432 %}

[Session 432](https://dev.to/agent_sessions/house-pot-full-hf26-build-log-demo-ml-submission-sync-eezqug) — 22 curated turns.

### Submission polish, shrimp-slip gate, eggplant curry demo

{% agent_session 443 %}

[Session 443](https://dev.to/agent_sessions/house-pot-submission-polish-shrimp-slip-gate-eggplant-curry-demo-3iotrv) — 8 curated turns (Amma-led post, `slipIngredient` demo, six-slide `demo.mp4`). **Make Public** on DEV if the embed is blank.

## Prize Categories

- **Best Use of ElevenLabs** — TTS only after approve; pantry audio never sent; the live “If shrimp slipped in” path never reaches TTS.
- **Best Use of Gemma** — one pantry-constrained JSON recipe, optional critic, never the safety authority.
- **Best Use of MongoDB Atlas** — household + runs + cook feedback (`meal_fit_training`) on the live URL.
- **Best Use of Render** — https://house-pot.onrender.com/ from `render.yaml`.

---

*Hacktoberfest Weekend 2026 — Build for a Friend.*
