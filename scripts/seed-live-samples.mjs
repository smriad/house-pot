#!/usr/bin/env node
/**
 * Create real propose → approve → narrate runs on production (MongoDB).
 * Usage: PRODUCTION_URL=https://house-pot.onrender.com node scripts/seed-live-samples.mjs
 * To reset live to 3 narrated samples only: npm run prune:live (then seed if needed).
 * Set PRUNE_BEFORE_SEED=1 to prune MongoDB before creating new runs.
 */
import path from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const BASE = (process.env.PRODUCTION_URL ?? "https://house-pot.onrender.com").replace(
  /\/$/,
  "",
);

const SAMPLES = [
  {
    cookName: "Amma",
    allergies: ["peanuts", "shellfish"],
    dislikes: ["very spicy"],
    favoriteCuisines: ["Bangladeshi", "comfort"],
    notes: "Dhaka flat — weeknight dal from the market bag.",
    pantryText: "red lentils, onion, garlic, rice, cumin, spinach, yogurt",
    diners: 3,
  },
  {
    cookName: "Khalu",
    allergies: ["shellfish"],
    dislikes: ["bitter gourd"],
    favoriteCuisines: ["South Asian"],
    notes: "Cauliflower alu after Friday market — no shrimp paste.",
    pantryText: "potato, cauliflower, onion, turmeric, mustard oil, rice, green chili",
    diners: 4,
  },
  {
    cookName: "Farida",
    allergies: ["peanuts"],
    dislikes: [],
    favoriteCuisines: ["Bengali", "weeknight"],
    notes: "Chicken curry when the kids stay for dinner.",
    pantryText: "chicken, ginger, tomato, onion, basmati rice, garam masala, yogurt",
    diners: 5,
  },
];

async function jsonFetch(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(300_000),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function seedOne(sample, index) {
  console.log(`\n[${index + 1}/3] ${sample.cookName} — ${sample.pantryText.slice(0, 48)}…`);

  const household = await jsonFetch("/api/household", {
    method: "POST",
    body: JSON.stringify({
      cookName: sample.cookName,
      allergies: sample.allergies,
      dislikes: sample.dislikes,
      favoriteCuisines: sample.favoriteCuisines,
      notes: sample.notes,
    }),
  });

  const run = await jsonFetch("/api/runs", {
    method: "POST",
    body: JSON.stringify({
      householdId: household.id,
      pantryText: sample.pantryText,
      diners: sample.diners,
    }),
  });

  const title = run.proposal?.title ?? "(no title)";
  const safe = run.pantryReview?.safeToNarrate;
  const missing = run.pantryReview?.missing?.length ?? 0;
  console.log(`  propose: ${title} | safeToNarrate=${safe} | missing=${missing}`);

  if (!safe || missing > 0) {
    console.warn("  SKIP approve — blocked:", run.pantryReview);
    return { household, run, narrated: false };
  }

  const approved = await jsonFetch(`/api/runs/${run.id}/approve`, {
    method: "POST",
    body: JSON.stringify({ approved: true, autoNarrate: true }),
  });

  const narrated = approved.status === "narrated";
  console.log(`  status: ${approved.status} | run ${run.id}`);
  console.log(`  kitchen: ${BASE}/?run=${run.id}`);
  console.log(`  history: ${BASE}/history?household=${household.id}`);

  return { household, run: approved, narrated };
}

async function main() {
  if (process.env.PRUNE_BEFORE_SEED === "1") {
    console.log("PRUNE_BEFORE_SEED=1 — keeping only latest narrated Amma/Khalu/Farida in MongoDB…");
    const { spawnSync } = await import("child_process");
    const pr = spawnSync("node", ["scripts/prune-live-db.mjs"], {
      stdio: "inherit",
      cwd: REPO_ROOT,
    });
    if (pr.status !== 0) process.exit(pr.status ?? 1);
  }

  console.log(`Seeding live samples at ${BASE}`);
  const health = await jsonFetch("/api/health");
  console.log(
    "  storage:",
    health.integrations?.storage,
    "| gemma live:",
    health.detail?.gemma?.live,
    "| elevenlabs:",
    health.integrations?.elevenlabs,
  );

  const results = [];
  for (let i = 0; i < SAMPLES.length; i++) {
    results.push(await seedOne(SAMPLES[i], i));
  }

  const ok = results.filter((r) => r.narrated).length;
  console.log(`\nDone: ${ok}/3 narrated on live.`);
  console.log(`All pots: ${BASE}/history/all`);
  if (ok < 3) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
