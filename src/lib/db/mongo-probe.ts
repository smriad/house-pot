import { hasMongo } from "@/lib/env";

export async function probeMongo(): Promise<boolean> {
  if (!hasMongo()) return false;
  try {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 4000,
    });
    await client.connect();
    await client.db("house_pot").command({ ping: 1 });
    await client.close();
    return true;
  } catch {
    return false;
  }
}
