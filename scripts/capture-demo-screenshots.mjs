#!/usr/bin/env node
/**
 * Capture kitchen + service-panel screenshots from live (or BASE_URL).
 *   BASE_URL=https://house-pot.onrender.com npm run demo:screenshots
 * Optional: DEMO_RUN_ID, DEMO_HOUSEHOLD_ID
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./lib/demo-env.mjs";

loadEnvLocal();

const BASE = process.env.BASE_URL?.trim() || "https://house-pot.onrender.com";
const RUN_ID =
  process.env.DEMO_RUN_ID?.trim() || "8073cda3-1865-4542-871b-5cba6afc9b4d";
const HOUSEHOLD_ID =
  process.env.DEMO_HOUSEHOLD_ID?.trim() ||
  "d0a210b8-b20c-41a7-ac6a-b53601454da1";
const outDir = path.join(process.cwd(), "public", "demo-screenshots");
const VIEW_W = parseInt(process.env.DEMO_VIEWPORT_WIDTH ?? "1920", 10) || 1920;
const VIEW_H = parseInt(process.env.DEMO_VIEWPORT_HEIGHT ?? "1080", 10) || 1080;

fs.mkdirSync(outDir, { recursive: true });

for (const f of fs.readdirSync(outDir)) {
  if (
    f.startsWith("05-integration-") ||
    f === "03-integrations-collapsed.png" ||
    f === "04-integrations-header.png" ||
    f === "04-history-all.png" ||
    f === "06-history-all.png" ||
    f === "07-household-history.png"
  ) {
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
await context.addInitScript(
  ({ householdId, runId }) => {
    try {
      localStorage.setItem("house-pot-household-id", householdId);
      localStorage.setItem("house-pot-last-run-id", runId);
    } catch {
      /* ignore */
    }
  },
  { householdId: HOUSEHOLD_ID, runId: RUN_ID },
);
const page = await context.newPage();

try {
  const kitchenUrl = `${BASE}/?run=${RUN_ID}`;
  console.log("Capturing", kitchenUrl, "→", outDir);

  await page.goto(kitchenUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page
    .getByRole("heading", { name: /Mild Eggplant and Potato Comfort Curry/i })
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await shot(page, "01-kitchen-top");

  const pantryBox = page.getByRole("textbox", { name: /Pantry & voice notes/i });
  await pantryBox.fill(
    "eggplant, potato, tomato, onion, garlic, turmeric, mustard oil, rice, coriander, green chili, eggs",
  );
  await page.getByRole("spinbutton", { name: /Diners/i }).fill("4");
  await pantryBox.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, "02-kitchen-form");

  const slip = page.getByRole("button", { name: /If shrimp slipped in/i });
  await slip.scrollIntoViewIfNeeded();
  await slip.click({ timeout: 15_000 });
  const slipCopy = page.getByText(/Approve stays off/i);
  await slipCopy.waitFor({ state: "visible", timeout: 15_000 });
  await slipCopy.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  await page.waitForTimeout(500);
  await shot(page, "03-approved-recipe");

  const showBtn = page.getByRole("button", { name: /Show dashboard/i });
  await showBtn.click({ timeout: 15_000 });
  await page
    .getByRole("button", { name: /Hide dashboard/i })
    .waitFor({ state: "visible", timeout: 30_000 });
  await page
    .getByRole("heading", { name: "Gemma (open weights)" })
    .waitFor({ state: "visible", timeout: 90_000 })
    .catch(() => undefined);
  await page.waitForTimeout(2500);

  await page
    .getByRole("heading", { name: "Kitchen services" })
    .evaluate((el) => el.scrollIntoView({ block: "start", inline: "nearest" }));
  await page.waitForTimeout(600);
  await shot(page, "04-integrations-dashboard");

  const staleIntegrations = path.join(outDir, "03-integrations-dashboard.png");
  if (fs.existsSync(staleIntegrations)) fs.unlinkSync(staleIntegrations);

  await page.goto(`${BASE}/history/all`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByRole("heading", { name: /Mild Eggplant/i }).first().waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await page.waitForTimeout(800);
  await shot(page, "05-history-all");

  await page.goto(`${BASE}/history?household=${HOUSEHOLD_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.getByRole("heading", { name: /Mild Eggplant/i }).first().waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await page.waitForTimeout(800);
  await shot(page, "06-household-history");

  const staleHouseholdFive = path.join(outDir, "05-household-history.png");
  if (fs.existsSync(staleHouseholdFive)) fs.unlinkSync(staleHouseholdFive);
} finally {
  await browser.close();
}

console.log("Done.");
