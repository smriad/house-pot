#!/usr/bin/env node
/**
 * Production MongoDB: keep only the latest narrated run per canonical cook.
 * Default cooks: Amma, Khalu, Farida (matches seed-live-samples.mjs).
 *
 * Usage: node scripts/prune-live-db.mjs
 * Requires MONGODB_URI in .env.local or the environment.
 */
import { MongoClient } from "mongodb";
import { loadEnvLocal } from "./lib/demo-env.mjs";

const DEFAULT_COOKS = ["Amma", "Khalu", "Farida"];

loadEnvLocal();

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("MONGODB_URI is required (e.g. in .env.local).");
  process.exit(1);
}

const cooks = (process.env.PRUNE_KEEP_COOKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const keepCookNames = cooks.length ? cooks : DEFAULT_COOKS;

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
  await client.connect();
  const db = client.db("house_pot");
  const runsCol = db.collection("runs");
  const householdsCol = db.collection("households");
  const memoriesCol = db.collection("memories");

  const [allRuns, allHouseholds] = await Promise.all([
    runsCol.find({}).sort({ createdAt: -1 }).toArray(),
    householdsCol.find({}).toArray(),
  ]);

  const cookByHousehold = new Map(
    allHouseholds.map((h) => [h.id, h.cookName ?? "Cook"]),
  );

  const keepRunIds = new Set();
  const keepHouseholdIds = new Set();

  for (const cook of keepCookNames) {
    const narrated = allRuns.filter(
      (r) =>
        r.status === "narrated" &&
        cookByHousehold.get(r.householdId) === cook,
    );
    const pick = narrated[0];
    if (!pick) {
      console.warn(`No narrated run for "${cook}" — skipping.`);
      continue;
    }
    keepRunIds.add(pick.id);
    keepHouseholdIds.add(pick.householdId);
    console.log(
      `Keep ${cook}: run ${pick.id} | household ${pick.householdId}`,
    );
  }

  if (keepRunIds.size === 0) {
    console.error("Nothing to keep; aborting without deletes.");
    await client.close();
    process.exit(1);
  }

  const keepRunList = [...keepRunIds];
  const keepHouseholdList = [...keepHouseholdIds];

  const [delRuns, delHouseholds, delMemories] = await Promise.all([
    runsCol.deleteMany({ id: { $nin: keepRunList } }),
    householdsCol.deleteMany({ id: { $nin: keepHouseholdList } }),
    memoriesCol.deleteMany({ householdId: { $nin: keepHouseholdList } }),
  ]);

  console.log(
    `Deleted — runs: ${delRuns.deletedCount}, households: ${delHouseholds.deletedCount}, memories: ${delMemories.deletedCount}`,
  );
  console.log(`Remaining runs: ${keepRunList.length}`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
