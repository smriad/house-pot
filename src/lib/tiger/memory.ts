import { hasTiger } from "@/lib/env";
import type { PoolConfig } from "pg";

function tigerPoolConfig(): PoolConfig {
  const raw = process.env.TIGER_DATABASE_URL!.trim();
  const isTigerCloud = /tsdb\.cloud|tigerdata\.com|timescale\.com/i.test(raw);

  if (!isTigerCloud) {
    return { connectionString: raw, connectionTimeoutMillis: 10_000 };
  }

  // pg treats sslmode=require as verify-full; Tiger Cloud needs explicit SSL opts.
  const url = new URL(raw.replace(/^postgresql:/, "postgres:"));
  return {
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "tsdb",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  };
}

export async function probeTiger(): Promise<boolean> {
  if (!hasTiger()) return false;
  try {
    const { Pool } = await import("pg");
    const pool = new Pool(tigerPoolConfig());
    await pool.query("SELECT 1");
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

/** Mirror cook feedback into Tiger (Postgres) when configured. */
export async function mirrorMemoryToTiger(
  householdId: string,
  text: string,
): Promise<boolean> {
  if (!hasTiger()) return false;
  try {
    const { Pool } = await import("pg");
    const pool = new Pool(tigerPoolConfig());
    await pool.query(
      `CREATE TABLE IF NOT EXISTS house_pot_memories (
        id SERIAL PRIMARY KEY,
        household_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    );
    await pool.query(
      `INSERT INTO house_pot_memories (household_id, content) VALUES ($1, $2)`,
      [householdId, text],
    );
    await pool.end();
    return true;
  } catch {
    return false;
  }
}
