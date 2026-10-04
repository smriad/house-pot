#!/usr/bin/env node
/**
 * Capture kitchen + sponsor panel screenshots for README / SUBMISSION.
 *   BASE_URL=https://house-pot.onrender.com npm run demo:screenshots
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./lib/demo-env.mjs";

loadEnvLocal();

const BASE = process.env.BASE_URL?.trim() || "https://house-pot.onrender.com";
const outDir = path.join(process.cwd(), "public", "demo-screenshots");
const VIEW_W = parseInt(process.env.DEMO_VIEWPORT_WIDTH ?? "1920", 10) || 1920;
const VIEW_H = parseInt(process.env.DEMO_VIEWPORT_HEIGHT ?? "1080", 10) || 1080;

fs.mkdirSync(outDir, { recursive: true });

/** Drop stale per-card integration captures from older script versions. */
for (const f of fs.readdirSync(outDir)) {
  if (f.startsWith("05-integration-") || f === "03-integrations-collapsed.png") {
    fs.unlinkSync(path.join(outDir, f));
  }
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  wrote", file);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: VIEW_W, height: VIEW_H },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

try {
  console.log("Capturing", BASE, "→", outDir);

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, "01-kitchen-top");

  await page.getByText("Pantry & voice notes", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, "02-kitchen-form");

  const showBtn = page.getByRole("button", { name: /Show dashboard/i });
  await showBtn.scrollIntoViewIfNeeded();
  await showBtn.click({ timeout: 15_000 });
  await page
    .getByRole("button", { name: /Hide dashboard/i })
    .waitFor({ state: "visible", timeout: 30_000 });
  await page
    .getByText("Gemma", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 90_000 })
    .catch(() => undefined);
  await page.waitForTimeout(2500);

  const panel = page.locator("section").filter({ hasText: "Sponsor integrations" });
  await panel.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("section")].find((s) =>
      s.textContent?.includes("Sponsor integrations"),
    );
    el?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -8);
  });
  await page.waitForTimeout(600);
  const integrationsFile = path.join(outDir, "03-integrations-dashboard.png");
  await page.screenshot({ path: integrationsFile });
  console.log("  wrote", integrationsFile);

  const legacyHeader = path.join(outDir, "04-integrations-header.png");
  if (fs.existsSync(legacyHeader)) fs.unlinkSync(legacyHeader);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.goto(`${BASE}/history/all`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);
  await shot(page, "04-history-all");

  await page.goto(`${BASE}/history?household=21679f68-19c2-42af-950d-890226540e46`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(1500);
  await shot(page, "05-household-history");

  const legacyHistory = path.join(outDir, "06-history-all.png");
  const legacyHousehold = path.join(outDir, "07-household-history.png");
  if (fs.existsSync(legacyHistory)) fs.unlinkSync(legacyHistory);
  if (fs.existsSync(legacyHousehold)) fs.unlinkSync(legacyHousehold);
} finally {
  await browser.close();
}

console.log("Done.");
