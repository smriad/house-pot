import { resolveGemmaBaseUrl } from "@/lib/gemma";

function ollamaRoot(): string {
  const base = resolveGemmaBaseUrl();
  return base.replace(/\/v1\/?$/, "");
}

function usesGoogleAi(): boolean {
  return resolveGemmaBaseUrl().includes("generativelanguage.googleapis.com");
}

/** Free on AI Studio — pantry memory vectors when Ollama is not on the host. */
async function googleEmbed(snippet: string): Promise<number[] | null> {
  const key = process.env.GEMMA_API_KEY?.trim();
  if (!key || !usesGoogleAi()) return null;
  const model = process.env.GOOGLE_EMBED_MODEL?.trim() || "text-embedding-004";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: snippet }] },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    const values = json.embedding?.values;
    return values?.length ? values : null;
  } catch {
    return null;
  }
}

async function ollamaEmbed(snippet: string): Promise<number[] | null> {
  const model = process.env.EMBED_MODEL?.trim() || "nomic-embed-text";
  try {
    const res = await fetch(`${ollamaRoot()}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: snippet }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { embedding?: number[] };
    return json.embedding?.length ? json.embedding : null;
  } catch {
    return null;
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  const snippet = text.trim().slice(0, 2000);
  if (!snippet) return null;

  if (!usesGoogleAi()) {
    const local = await ollamaEmbed(snippet);
    if (local) return local;
  }
  const cloud = await googleEmbed(snippet);
  if (cloud) return cloud;
  return ollamaEmbed(snippet);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
