import { resolveGemmaBaseUrl } from "@/lib/gemma";

function ollamaRoot(): string {
  const base = resolveGemmaBaseUrl();
  return base.replace(/\/v1\/?$/, "");
}

export async function embedText(text: string): Promise<number[] | null> {
  const snippet = text.trim().slice(0, 2000);
  if (!snippet) return null;

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
