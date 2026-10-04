#!/usr/bin/env node
/**
 * Dump meal_fit_training rows for offline TabPFN / sklearn experiments.
 * Usage: node scripts/export-meal-fit-training.mjs
 */
import { MongoClient } from "mongodb";
import { loadEnvLocal } from "./lib/demo-env.mjs";

loadEnvLocal();
const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("MONGODB_URI required");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const rows = await client
  .db("house_pot")
  .collection("meal_fit_training")
  .find({})
  .sort({ createdAt: -1 })
  .toArray();
await client.close();

console.log(JSON.stringify(rows, null, 2));
console.error(`\n# ${rows.length} training rows`);
