import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Collection, Db, MongoClient } from "mongodb";
import type { Household, KitchenRun, PantryMemory } from "@/lib/types";
import type { MealFitFeatures } from "@/lib/kitchen/meal-fit-features";
import { hasMongo } from "@/lib/env";
import { cosineSimilarity, embedText } from "@/lib/embeddings";

const LOCAL_DIR = path.join(process.cwd(), ".data");

export type MealFitTrainingRow = {
  id: string;
  runId: string;
  householdId: string;
  features: MealFitFeatures;
  preferenceScore?: number;
  feedbackText: string;
  label: number;
  recipeTitle?: string;
  createdAt: string;
};

type LocalDb = {
  households: Household[];
  runs: KitchenRun[];
  memories: PantryMemoryDoc[];
  mealFitTraining: MealFitTrainingRow[];
};

type PantryMemoryDoc = PantryMemory & { embedding?: number[] };

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
/** After a failed connect, use local JSON so a bad Atlas URI does not 500 the app. */
let mongoConnectFailed = false;

async function mongoReady(): Promise<boolean> {
  if (!hasMongo() || mongoConnectFailed) return false;
  try {
    await getMongo();
    return true;
  } catch {
    mongoConnectFailed = true;
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch {
        /* ignore */
      }
    }
    mongoClient = null;
    mongoDb = null;
    return false;
  }
}

async function readLocal(): Promise<LocalDb> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const file = path.join(LOCAL_DIR, "house-pot.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    return {
      households: parsed.households ?? [],
      runs: parsed.runs ?? [],
      memories: parsed.memories ?? [],
      mealFitTraining: parsed.mealFitTraining ?? [],
    };
  } catch {
    return { households: [], runs: [], memories: [], mealFitTraining: [] };
  }
}

async function writeLocal(db: LocalDb): Promise<void> {
  const file = path.join(LOCAL_DIR, "house-pot.json");
  await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
}

async function getMongo(): Promise<Db> {
  if (mongoDb) return mongoDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  const { MongoClient } = await import("mongodb");
  mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoClient.connect();
  mongoDb = mongoClient.db("house_pot");
  return mongoDb;
}

function householdsCol(db: Db): Collection<Household> {
  return db.collection<Household>("households");
}

function runsCol(db: Db): Collection<KitchenRun> {
  return db.collection<KitchenRun>("runs");
}

function memoriesCol(db: Db): Collection<PantryMemoryDoc> {
  return db.collection<PantryMemoryDoc>("memories");
}

function trainingCol(db: Db): Collection<MealFitTrainingRow> {
  return db.collection<MealFitTrainingRow>("meal_fit_training");
}

export async function upsertHousehold(
  input: Omit<Household, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Household> {
  const now = new Date().toISOString();
  const record: Household = {
    id: input.id ?? randomUUID(),
    cookName: input.cookName,
    allergies: input.allergies,
    dislikes: input.dislikes,
    favoriteCuisines: input.favoriteCuisines,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  if (await mongoReady()) {
    const db = await getMongo();
    const { createdAt, ...fields } = record;
    await householdsCol(db).updateOne(
      { id: record.id },
      { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt } },
      { upsert: true },
    );
    return record;
  }

  const local = await readLocal();
  const idx = local.households.findIndex((h) => h.id === record.id);
  if (idx >= 0) {
    local.households[idx] = { ...local.households[idx], ...record, updatedAt: now };
  } else {
    local.households.push(record);
  }
  await writeLocal(local);
  return record;
}

export async function getHousehold(id: string): Promise<Household | null> {
  if (await mongoReady()) {
    const db = await getMongo();
    return householdsCol(db).findOne({ id });
  }
  const local = await readLocal();
  return local.households.find((h) => h.id === id) ?? null;
}

export async function getHouseholdsByIds(
  ids: string[],
): Promise<Map<string, Household>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, Household>();
  if (unique.length === 0) return map;

  if (await mongoReady()) {
    const db = await getMongo();
    const docs = await householdsCol(db)
      .find({ id: { $in: unique } })
      .toArray();
    for (const h of docs) map.set(h.id, h);
    return map;
  }

  const local = await readLocal();
  for (const id of unique) {
    const h = local.households.find((row) => row.id === id);
    if (h) map.set(id, h);
  }
  return map;
}

/** Fields omitted when loading run lists (audio/trace are large). */
const RUN_LIST_PROJECTION = {
  audioBase64: 0,
  trace: 0,
  kitchenBrain: 0,
  voiceTranscript: 0,
  serpInspiration: 0,
} as const;

export async function saveRun(run: KitchenRun): Promise<void> {
  if (await mongoReady()) {
    const db = await getMongo();
    await runsCol(db).updateOne({ id: run.id }, { $set: run }, { upsert: true });
    return;
  }
  const local = await readLocal();
  const idx = local.runs.findIndex((r) => r.id === run.id);
  if (idx >= 0) local.runs[idx] = run;
  else local.runs.push(run);
  await writeLocal(local);
}

export async function getRun(id: string): Promise<KitchenRun | null> {
  if (await mongoReady()) {
    const db = await getMongo();
    return runsCol(db).findOne({ id });
  }
  const local = await readLocal();
  return local.runs.find((r) => r.id === id) ?? null;
}

export async function listRunsForHousehold(
  householdId: string,
  limit = 8,
  skip = 0,
): Promise<KitchenRun[]> {
  if (await mongoReady()) {
    const db = await getMongo();
    return runsCol(db)
      .find({ householdId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  const local = await readLocal();
  return local.runs
    .filter((r) => r.householdId === householdId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(skip, skip + limit);
}

export async function listAllRuns(
  limit = 50,
  skip = 0,
  options?: { listView?: boolean },
): Promise<KitchenRun[]> {
  if (await mongoReady()) {
    const db = await getMongo();
    return runsCol(db)
      .find({}, options?.listView ? { projection: RUN_LIST_PROJECTION } : {})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  const local = await readLocal();
  return [...local.runs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(skip, skip + limit);
}

export async function insertMealFitTrainingRow(
  row: Omit<MealFitTrainingRow, "id" | "createdAt">,
): Promise<void> {
  const doc: MealFitTrainingRow = {
    ...row,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (await mongoReady()) {
    const db = await getMongo();
    await trainingCol(db).insertOne(doc);
    return;
  }
  const local = await readLocal();
  if (!local.mealFitTraining) local.mealFitTraining = [];
  local.mealFitTraining.push(doc);
  await writeLocal(local);
}

export async function addPantryMemory(
  householdId: string,
  text: string,
  tags: string[],
): Promise<void> {
  const embedding = await embedText(text);
  const entry: PantryMemoryDoc = {
    id: randomUUID(),
    householdId,
    text,
    tags,
    embedding: embedding ?? undefined,
    createdAt: new Date().toISOString(),
  };
  if (await mongoReady()) {
    const db = await getMongo();
    await memoriesCol(db).insertOne(entry);
    return;
  }
  const local = await readLocal();
  local.memories.push(entry);
  await writeLocal(local);
}

export async function listMemories(
  householdId: string,
  limit = 20,
): Promise<PantryMemory[]> {
  if (await mongoReady()) {
    const db = await getMongo();
    return memoriesCol(db)
      .find({ householdId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
  const local = await readLocal();
  return local.memories
    .filter((m) => m.householdId === householdId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function searchMemories(
  householdId: string,
  query: string,
  limit = 5,
): Promise<PantryMemory[]> {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  const queryEmbedding = await embedText(query);
  const vectorIndex = process.env.MONGODB_VECTOR_INDEX?.trim();

  if ((await mongoReady()) && vectorIndex && queryEmbedding) {
    try {
      const db = await getMongo();
      const vectorHits = await memoriesCol(db)
        .aggregate<PantryMemoryDoc>([
          {
            $vectorSearch: {
              index: vectorIndex,
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit,
              filter: { householdId },
            },
          },
        ])
        .toArray();
      if (vectorHits.length) return vectorHits;
    } catch {
      /* fall back to hybrid rank */
    }
  }

  if (await mongoReady()) {
    const db = await getMongo();
    const all = await memoriesCol(db)
      .find({ householdId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return rankMemories(all, tokens, queryEmbedding).slice(0, limit);
  }

  const local = await readLocal();
  const all = local.memories.filter((m) => m.householdId === householdId);
  return rankMemories(all, tokens, queryEmbedding).slice(0, limit);
}

function rankMemories(
  memories: PantryMemoryDoc[],
  tokens: string[],
  queryEmbedding: number[] | null,
): PantryMemory[] {
  if (tokens.length === 0 && !queryEmbedding) {
    return [...memories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return [...memories].sort((a, b) => {
    const score = (m: PantryMemoryDoc) => {
      let s = tokens.reduce(
        (acc, t) => acc + (m.text.toLowerCase().includes(t) ? 1 : 0),
        0,
      );
      if (queryEmbedding && m.embedding?.length) {
        s += cosineSimilarity(queryEmbedding, m.embedding) * 3;
      }
      return s;
    };
    return score(b) - score(a);
  });
}
