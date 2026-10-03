#!/usr/bin/env node
/**
 * Record a short House Pot demo (propose → approve → narrate) against BASE_URL.
 * Requires: npm i -D @playwright/test && npx playwright install chromium
 *
 *   BASE_URL=https://house-pot.onrender.com node scripts/record-demo.mjs
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL?.trim() || "https://house-pot.onrender.com";
const outDir = path.join(process.cwd(), ".data", "demo-video");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  console.log("Opening", BASE);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 });

  await page.getByRole("button", { name: "Propose tonight's pot" }).click();
  console.log("Proposing… (up to 3 min)");
  await page.getByRole("button", { name: "Approve & read aloud" }).waitFor({
    state: "visible",
    timeout: 180_000,
  });
  await sleep(2000);
  await page.getByRole("button", { name: "Approve & read aloud" }).click();
  console.log("Narrating… (up to 2 min)");
  await page.getByText(/narrated|playing|audio/i).first().waitFor({
    timeout: 120_000,
  }).catch(() => sleep(15_000));
  await sleep(5000);
} finally {
  await context.close();
  await browser.close();
}

const webm = fs.readdirSync(outDir).find((f) => f.endsWith(".webm"));
if (webm) {
  const src = path.join(outDir, webm);
  const dest = path.join(process.cwd(), "public", "demo.webm");
  fs.copyFileSync(src, dest);
  console.log("Saved", dest);
  console.log("Convert: ffmpeg -i public/demo.webm -c:v libx264 -c:a aac public/demo.mp4");
} else {
  console.log("No webm in", outDir);
}
