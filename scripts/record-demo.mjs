#!/usr/bin/env node
/**
 * Guided demo: whom / what / why (architecture) / how — synced to UI + cursor.
 *
 *   npm run demo:record
 *   DEMO_REUSE_VOICE=0 npm run demo:record
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { loadEnvLocal, mediaDurationSec, sleep } from "./lib/demo-env.mjs";
import {
  clickWithCursor,
  injectDemoCursor,
  injectFullscreenDemoLayout,
  pointTo,
} from "./lib/demo-cursor.mjs";
import {
  buildTourAudioTrack,
  mergeVideoAndAudio,
  synthesizeRecipeNarration,
  synthesizeTourVoices,
} from "./lib/demo-voice.mjs";

const VIEW_W = parseInt(process.env.DEMO_VIEWPORT_WIDTH ?? "1920", 10) || 1920;
const VIEW_H = parseInt(process.env.DEMO_VIEWPORT_HEIGHT ?? "1080", 10) || 1080;

const BASE = process.env.BASE_URL?.trim() || "http://localhost:3000";
const outDir = path.join(process.cwd(), ".data", "demo-video");
const voDir = path.join(process.cwd(), ".data", "demo-vo");
const dataDir = path.join(process.cwd(), ".data");
const publicDir = path.join(process.cwd(), "public");

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith(".webm")) fs.unlinkSync(path.join(outDir, f));
}
loadEnvLocal();

let runId = null;
/** @type {{ id: string, atSec: number, path: string }[]} */
const timeline = [];
let elapsedSec = 0;

function markChapter(id, voicePath, atSec) {
  timeline.push({ id, atSec, path: voicePath });
  console.log(`  chapter ${id} @ ${atSec.toFixed(1)}s`);
  return atSec;
}

async function chapter(page, id, voicePath, minSec, action) {
  const atSec = elapsedSec;
  markChapter(id, voicePath, atSec);
  const voiceMin = mediaDurationSec(voicePath) + 0.35;
  const targetSec = Math.max(minSec, voiceMin);
  const t0 = Date.now();
  await action();
  while ((Date.now() - t0) / 1000 < targetSec) await sleep(150);
  const spent = (Date.now() - t0) / 1000;
  elapsedSec = atSec + spent;
}

async function fetchRun(id) {
  const res = await fetch(`${BASE}/api/runs/${id}`);
  if (!res.ok) throw new Error(`GET run ${id}: ${res.status}`);
  return res.json();
}

async function waitForNarration(id, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await fetchRun(id);
    if (data?.status === "narrated" && data.audioBase64) return data;
    if (data?.status === "failed") throw new Error(data.error ?? "Run failed");
    await sleep(2500);
  }
  throw new Error("Timed out waiting for narration");
}

const voiceFiles = await synthesizeTourVoices(voDir);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: outDir, size: { width: VIEW_W, height: VIEW_H } },
  viewport: { width: VIEW_W, height: VIEW_H },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await injectDemoCursor(page);
await injectFullscreenDemoLayout(page);

page.on("response", async (res) => {
  try {
    const url = res.url();
    if (
      res.request().method() === "POST" &&
      url.endsWith("/api/runs") &&
      res.ok()
    ) {
      const data = await res.json();
      if (data?.id) runId = data.id;
    }
  } catch {
    /* ignore */
  }
});

let recipeAtSec = 0;

async function cardScroll(page) {
  const card = page.locator("article").filter({ hasText: /Ingredients/i }).first();
  if (await card.isVisible().catch(() => false)) {
    await card.scrollIntoViewIfNeeded();
  }
}

try {
  console.log("Opening", BASE);

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, 0));

  await chapter(page, "nextjs", voiceFiles.nextjs, 14, async () => {
    await pointTo(page, page.getByText(/Build for a Friend/i).first());
    await pointTo(page, page.getByRole("heading", { name: /Who are you cooking/i }));
    await pointTo(page, page.locator("main").first());
  });

  await chapter(page, "health", voiceFiles.health, 14, async () => {
    await pointTo(page, page.getByText(/gemma:/i).first());
    await pointTo(page, page.getByText(/mongodb|storage/i).first());
    await pointTo(page, page.getByText(/elevenlabs/i).first());
  });

  await chapter(page, "integrations", voiceFiles.integrations, 24, async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const showBtn = page.getByRole("button", { name: /Show dashboard/i });
    if (await showBtn.isVisible().catch(() => false)) {
      await clickWithCursor(page, showBtn);
    }
    await page
      .getByText(/live|off/)
      .first()
      .waitFor({ state: "visible", timeout: 90_000 })
      .catch(() => undefined);
    await sleep(1500);
    const panel = page.locator("section").filter({ hasText: "Sponsor integrations" });
    const cards = panel.locator("div.rounded-2xl.border-2");
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -24));
      await pointTo(page, card);
      await sleep(350);
    }
    const refresh = page.getByRole("button", { name: /Refresh probes/i });
    if (await refresh.isVisible().catch(() => false)) {
      await pointTo(page, refresh);
      await sleep(1200);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await chapter(page, "mongodb_profile", voiceFiles.mongodb_profile, 14, async () => {
    await pointTo(page, page.getByLabel("Cook's name"));
    await pointTo(page, page.getByLabel("Allergies"));
    await pointTo(page, page.getByLabel("Dislikes"));
    await pointTo(page, page.getByLabel("Diners"));
  });

  await chapter(page, "input_stt", voiceFiles.input_stt, 13, async () => {
    await pointTo(page, page.getByLabel("Pantry & voice notes"));
    await pointTo(page, page.getByRole("button", { name: "Browser speech" }));
    await pointTo(page, page.getByRole("button", { name: "Record pantry" }));
    await pointTo(page, page.getByRole("button", { name: "Propose tonight's pot" }));
  });

  await chapter(page, "gemma", voiceFiles.gemma, 10, async () => {
    await clickWithCursor(
      page,
      page.getByRole("button", { name: "Propose tonight's pot" }),
    );
    console.log("Waiting for recipe (up to 3 min)…");
    await page.getByRole("button", { name: "Approve & read aloud" }).waitFor({
      state: "visible",
      timeout: 180_000,
    });
  });

  await chapter(page, "policy", voiceFiles.policy, 14, async () => {
    const card = page.locator("article").filter({ hasText: /Ingredients/i }).first();
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -48));
    await pointTo(page, card);
    await pointTo(
      page,
      page.getByText(/in the kitchen|not in the pantry/i).first(),
    );
    const fit = page.getByText(/Friend fit/i);
    if (await fit.isVisible().catch(() => false)) {
      await pointTo(page, fit);
    }
    const status = page.getByText(/awaiting approval|approved/i).first();
    if (await status.isVisible().catch(() => false)) {
      await pointTo(page, status);
    }
  });

  await chapter(page, "elevenlabs", voiceFiles.elevenlabs, 13, async () => {
    await pointTo(
      page,
      page.getByRole("button", { name: "Approve & read aloud" }),
    );
    await pointTo(page, page.getByText(/ElevenLabs speaks only/i).first());
  });

  await chapter(page, "mongodb_runs", voiceFiles.mongodb_runs, 12, async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await pointTo(page, page.getByRole("link", { name: "Pot history" }));
    const recent = page.getByLabel("Recent pots");
    if (await recent.isVisible().catch(() => false)) {
      await pointTo(page, recent);
    }
    await cardScroll(page);
    await pointTo(
      page,
      page.getByRole("button", { name: "Approve & read aloud" }),
    );
  });

  recipeAtSec = elapsedSec;
  markChapter("recipe-intro", voiceFiles.recipe, recipeAtSec);
  const recipeIntroDur = mediaDurationSec(voiceFiles.recipe) + 0.4;
  await sleep(recipeIntroDur * 1000);

  await clickWithCursor(
    page,
    page.getByRole("button", { name: "Approve & read aloud" }),
  );
  console.log("Narrating…");

  await page.locator("audio").first().waitFor({ state: "visible", timeout: 180_000 }).catch(() => undefined);

  let narrSec = 8;
  if (runId) {
    console.log("Run id:", runId);
    const run = await waitForNarration(runId);
    const mp3 = path.join(dataDir, "demo-narration.mp3");
    if (run.proposal) {
      console.log("Recipe voice (demo male):", run.proposal.title);
      await synthesizeRecipeNarration(run.proposal, mp3);
    } else if (run.audioBase64) {
      fs.writeFileSync(mp3, Buffer.from(run.audioBase64, "base64"));
    }
    narrSec = mediaDurationSec(mp3);
    await sleep(narrSec * 1000);
  } else {
    await sleep(8000);
  }
  elapsedSec = recipeAtSec + recipeIntroDur + narrSec;
} finally {
  await context.close();
  await browser.close();
}

const webm = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith(".webm"))
  .map((f) => ({ f, m: fs.statSync(path.join(outDir, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m)[0]?.f;
if (!webm) {
  console.error("No webm in", outDir);
  process.exit(1);
}

const webmPath = path.join(outDir, webm);
const webmDest = path.join(publicDir, "demo.webm");
fs.copyFileSync(webmPath, webmDest);
const videoSec = mediaDurationSec(webmDest);
console.log("Video:", webmDest, `${videoSec.toFixed(1)}s`);

const tourTimeline = timeline.filter((t) => t.id !== "recipe-intro");
const tourOnlyMp3 = path.join(dataDir, "demo-tour-audio.mp3");
buildTourAudioTrack(
  tourTimeline.map((t) => ({ atSec: t.atSec, path: t.path })),
  videoSec,
  tourOnlyMp3,
);

const recipeMp3 = path.join(dataDir, "demo-narration.mp3");
const fullAudio = path.join(dataDir, "demo-full-audio.mp3");
const recipeIntroAt =
  timeline.find((t) => t.id === "recipe-intro")?.atSec ?? recipeAtSec;
const audioSegments = [
  { atSec: 0, path: tourOnlyMp3 },
  { atSec: recipeIntroAt, path: voiceFiles.recipe },
];
if (fs.existsSync(recipeMp3)) {
  audioSegments.push({
    atSec: recipeIntroAt + mediaDurationSec(voiceFiles.recipe) + 0.4,
    path: recipeMp3,
  });
}
const audioTotal =
  videoSec +
  (fs.existsSync(recipeMp3) ? mediaDurationSec(recipeMp3) + 5 : 3);
buildTourAudioTrack(audioSegments, audioTotal, fullAudio);

const mp4Path = path.join(publicDir, "demo.mp4");
console.log("Merging → public/demo.mp4");
mergeVideoAndAudio(webmDest, fullAudio, mp4Path);

const duration = execFileSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    mp4Path,
  ],
  { encoding: "utf8" },
).trim();
console.log(`Wrote ${mp4Path} (${duration}s)`);
fs.writeFileSync(
  path.join(dataDir, "demo-timeline.json"),
  JSON.stringify({ timeline, videoSec, recipeAtSec }, null, 2),
);
