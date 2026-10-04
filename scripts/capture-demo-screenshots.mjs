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
  await shot(page, "01-kitchen-top");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35));
  await page.waitForTimeout(500);
  await shot(page, "02-kitchen-form");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "03-integrations-collapsed");

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

  await shot(page, "04-integrations-header");

  const panel = page.locator("section").filter({ hasText: "Sponsor integrations" });
  const cards = panel.locator("div.rounded-2xl.border-2");
  const n = await cards.count();
  console.log("  integration cards:", n);

  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -40));
    await page.waitForTimeout(250);
    const label =
      (await card.locator("p.text-sm.font-medium").first().textContent())?.trim() ||
      `card-${i}`;
    const safe = label
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    await shot(
      page,
      `05-integration-${String(i + 1).padStart(2, "0")}-${safe.slice(0, 40)}`,
    );
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.goto(`${BASE}/history/all`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);
  await shot(page, "06-history-all");

  await page.goto(`${BASE}/history?household=21679f68-19c2-42af-950d-890226540e46`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(1500);
  await shot(page, "07-household-history");
} finally {
  await browser.close();
}

console.log("Done.");
