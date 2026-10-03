import { hasBackboard } from "@/lib/env";

const BASE = "https://app.backboard.io/api";

type SearchHit = { id: string; content: string; score?: number | null };

export async function probeBackboard(): Promise<boolean> {
  if (!hasBackboard()) return false;
  const assistantId = process.env.BACKBOARD_ASSISTANT_ID?.trim();
  if (!assistantId) return false;
  try {
    const res = await fetch(
      `${BASE}/assistants/${assistantId}/memories?page_size=1`,
      {
        headers: { "X-API-Key": process.env.BACKBOARD_API_KEY! },
        signal: AbortSignal.timeout(8000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchBackboardMemories(
  query: string,
  limit = 5,
): Promise<SearchHit[]> {
  if (!hasBackboard()) return [];
  const assistantId = process.env.BACKBOARD_ASSISTANT_ID?.trim();
  if (!assistantId) return [];

  const res = await fetch(
    `${BASE}/assistants/${assistantId}/memories/search`,
    {
      method: "POST",
      headers: {
        "X-API-Key": process.env.BACKBOARD_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!res.ok) return [];

  const json = (await res.json()) as {
    memories?: SearchHit[];
  };
  return json.memories ?? [];
}

export async function addBackboardMemory(
  content: string,
  metadata?: Record<string, string>,
): Promise<boolean> {
  if (!hasBackboard()) return false;
  const assistantId = process.env.BACKBOARD_ASSISTANT_ID?.trim();
  if (!assistantId) return false;

  const res = await fetch(`${BASE}/assistants/${assistantId}/memories`, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.BACKBOARD_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, metadata }),
    signal: AbortSignal.timeout(12_000),
  });
  return res.ok;
}
