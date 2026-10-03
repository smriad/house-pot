"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Household, KitchenRun, PantryMemory, Recipe } from "@/lib/types";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import KitchenProgress from "@/components/KitchenProgress";
import { cookApprovedRun, runStatusLabel } from "@/lib/kitchen/run-display";

const STORAGE_KEY = "house-pot-household-id";
const RUN_STORAGE_KEY = "house-pot-last-run-id";

function runStatusLabelKitchen(status: KitchenRun["status"]): string {
  const base = runStatusLabel(status);
  if (status === "awaiting_approval") return "Awaiting cook approval";
  if (status === "approved") return "Approved — ready to narrate";
  if (status === "failed") return "Step failed — you can retry below";
  return base;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <article className="rounded-2xl border border-[#3D5F58]/30 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold text-[#2E4742]">{recipe.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">{recipe.summary}</p>
      {recipe.allergyWarnings.length > 0 && (
        <p className="mt-3 rounded-lg bg-[#E97B77]/15 px-3 py-2 text-sm text-[#671912]">
          Allergy watch: {recipe.allergyWarnings.join(", ")}
        </p>
      )}
      <h4 className="mt-4 text-sm font-semibold uppercase tracking-wide text-[#3D5F58]">
        Ingredients
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
        {recipe.ingredients.map((ing) => (
          <li key={`${ing.item}-${ing.amount}`}>
            {ing.amount} {ing.item}
            {ing.substitute ? ` (or ${ing.substitute})` : ""}
          </li>
        ))}
      </ul>
      <h4 className="mt-4 text-sm font-semibold uppercase tracking-wide text-[#3D5F58]">
        Steps
      </h4>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-zinc-800">
        {recipe.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-zinc-500">{recipe.openSourceRationale}</p>
    </article>
  );
}

export default function HousePotApp() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [cookName, setCookName] = useState("Amma");
  const [allergies, setAllergies] = useState("peanuts, shellfish");
  const [dislikes, setDislikes] = useState("very spicy");
  const [pantry, setPantry] = useState(
    "red lentils, onion, garlic, rice, cumin, spinach, yogurt",
  );
  const [diners, setDiners] = useState(3);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [run, setRun] = useState<KitchenRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, string | boolean> | null>(null);
  const [lastTranscribeEngine, setLastTranscribeEngine] = useState<string | null>(null);
  const [pantryMemories, setPantryMemories] = useState<PantryMemory[]>([]);
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [runHistory, setRunHistory] = useState<KitchenRun[]>([]);
  const [copiedRecipe, setCopiedRecipe] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  const audioUrl = useMemo(() => {
    if (!run?.audioBase64) return null;
    return `data:audio/mpeg;base64,${run.audioBase64}`;
  }, [run?.audioBase64]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setHealth(j.integrations))
      .catch(() => setHealth(null));
  }, []);

  const ensureHousehold = useCallback(async (): Promise<Household> => {
    const existingId = localStorage.getItem(STORAGE_KEY);
    const body = {
      id: existingId ?? undefined,
      cookName,
      allergies: allergies
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      dislikes: dislikes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      favoriteCuisines: ["South Asian", "comfort"],
      notes: "Built for Hacktoberfest Weekend — Build for a Friend",
    };
    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Could not save household profile");
    const h = (await res.json()) as Household;
    localStorage.setItem(STORAGE_KEY, h.id);
    setHousehold(h);
    void fetch(`/api/household/${h.id}/memories`)
      .then((r) => r.json())
      .then((j) => setPantryMemories(j.memories ?? []))
      .catch(() => setPantryMemories([]));
    return h;
  }, [allergies, cookName, dislikes]);

  const persistRun = useCallback((next: KitchenRun) => {
    setRun(next);
    localStorage.setItem(RUN_STORAGE_KEY, next.id);
  }, []);

  const loadRunById = useCallback(async (runId: string) => {
    const res = await fetch(`/api/runs/${runId}`);
    if (!res.ok) return;
    const data = (await res.json()) as KitchenRun;
    persistRun(data);
  }, [persistRun]);

  const refreshRunHistory = useCallback(async (householdId: string) => {
    const res = await fetch(`/api/household/${householdId}/runs`);
    if (!res.ok) return;
    const j = (await res.json()) as { runs: KitchenRun[] };
    setRunHistory(j.runs ?? []);
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setHydrating(false);
      return;
    }
    void (async () => {
      try {
        const hRes = await fetch(`/api/household?id=${encodeURIComponent(id)}`);
        if (hRes.ok) {
          const h = (await hRes.json()) as Household;
          setHousehold(h);
          setCookName(h.cookName);
          setAllergies(h.allergies.join(", "));
          setDislikes(h.dislikes.join(", "));
        }
        const memRes = await fetch(`/api/household/${id}/memories`);
        if (memRes.ok) {
          const j = await memRes.json();
          setPantryMemories(j.memories ?? []);
        }
        await refreshRunHistory(id);
        const runFromUrl = new URLSearchParams(window.location.search).get("run");
        const lastRunId = runFromUrl ?? localStorage.getItem(RUN_STORAGE_KEY);
        if (lastRunId) await loadRunById(lastRunId);
      } finally {
        setHydrating(false);
      }
    })();
  }, [loadRunById, refreshRunHistory]);

  const startWhisperRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "pantry.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Whisper transcription failed");
          return;
        }
        setVoiceTranscript(data.text);
        setLastTranscribeEngine(data.engine ?? null);
        setPantry((p) => (p ? `${p}\n${data.text}` : data.text));
      };
      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied. Use browser speech or type instead.");
    }
  };

  const stopWhisperRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  const startListening = () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("Speech recognition is not available in this browser. Type pantry notes instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      setVoiceTranscript(text);
      setPantry((p) => (p ? `${p}\n${text}` : text));
    };
    rec.onerror = () => setError("Could not capture voice. Try again or type manually.");
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const proposeMeal = async () => {
    setError(null);
    setLoading(true);
    setRun(null);
    try {
      const h = household ?? await ensureHousehold();
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: h.id,
          pantryText: pantry,
          voiceTranscript: voiceTranscript || undefined,
          diners,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      persistRun(data as KitchenRun);
      const hId = (data as KitchenRun).householdId;
      void refreshRunHistory(hId);
      void fetch(`/api/household/${hId}/memories`)
        .then((r) => r.json())
        .then((j) => setPantryMemories(j.memories ?? []))
        .catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const downloadTrace = () => {
    if (!run) return;
    window.open(`/api/runs/${run.id}/trace`, "_blank");
  };

  const downloadEntire = () => {
    if (!run) return;
    window.open(`/api/runs/${run.id}/entire`, "_blank");
  };

  const approve = async (approved: boolean, autoNarrate = false) => {
    if (!run) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, autoNarrate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approve failed");
      persistRun(data as KitchenRun);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoading(false);
    }
  };

  const narrate = async () => {
    if (!run) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/narrate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Narration failed");
      persistRun(data as KitchenRun);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Narration failed");
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!run || !feedback.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Feedback failed");
      persistRun(data as KitchenRun);
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback failed");
    } finally {
      setLoading(false);
    }
  };

  const copyRecipe = () => {
    if (!run?.proposal) return;
    const text = [
      run.proposal.title,
      run.proposal.summary,
      "",
      "Ingredients:",
      ...run.proposal.ingredients.map((i) => `- ${i.amount} ${i.item}`),
      "",
      "Steps:",
      ...run.proposal.steps.map((s, i) => `${i + 1}. ${s}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    setCopiedRecipe(true);
    window.setTimeout(() => setCopiedRecipe(false), 2000);
  };

  const showApproveActions =
    run?.proposal && run.status === "awaiting_approval";
  const showNarrateActions =
    run?.proposal &&
    (run.status === "approved" || (run.status === "failed" && cookApprovedRun(run)));

  return (
    <div className="min-h-full bg-[#F2F2EB] text-[#231F20]">
      <header className="border-b border-[#3D5F58]/20 bg-[#3D5F58] px-6 py-8 text-[#F2F2EB]">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8BB2DE]">House Pot</p>
        <h1 className="mt-2 font-mono text-3xl font-semibold">Build for a Friend</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#F2F2EB]/90">
          Open-weight Gemma plans the meal from what is in the kitchen. MongoDB remembers the pantry.
          ElevenLabs reads the recipe aloud only after {cookName || "your cook"} taps approve.
        </p>
        <Link
          href="/history"
          className="mt-4 inline-block rounded-full border border-[#F2F2EB]/35 px-4 py-1.5 text-sm font-medium text-[#F2F2EB] hover:bg-[#F2F2EB]/10"
        >
          View pot history →
        </Link>
        {health && (
          <p className="mt-4 font-mono text-xs text-[#F5B726]">
            gemma:{String(health.gemma)} · {String(health.storage ?? "local")} · elevenlabs:
            {health.elevenlabs ? "tts" : "off"}
            {health.elevenlabsStt ? "+scribe" : ""} · temporal:
            {health.temporal ? "on" : "off"} · embed:
            {health.embeddings ? "on" : "off"} · serp:{health.serpapi ? "on" : "off"}
          </p>
        )}
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-mono text-lg text-[#2E4742]">Who are you cooking for?</h2>
          <label className="block text-sm">
            Cook&apos;s name
            <input
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              value={cookName}
              onChange={(e) => setCookName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Allergies (comma-separated)
            <input
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Dislikes (comma-separated)
            <input
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="very spicy, cilantro…"
            />
          </label>
          <label className="block text-sm">
            Diners
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-24 rounded-xl border border-zinc-300 bg-white px-3 py-2"
              value={diners}
              onChange={(e) => setDiners(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            Pantry & voice notes
            <textarea
              rows={6}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
              value={pantry}
              onChange={(e) => setPantry(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={recording ? stopWhisperRecording : startWhisperRecording}
              className="rounded-full bg-[#2E4742] px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {recording ? "Stop recording" : "Record pantry (Whisper / Scribe)"}
            </button>
            <button
              type="button"
              onClick={startListening}
              disabled={listening}
              className="rounded-full border border-[#2E4742] px-5 py-2 text-sm font-medium text-[#2E4742] disabled:opacity-60"
            >
              {listening ? "Listening…" : "Browser speech"}
            </button>
            <button
              type="button"
              onClick={proposeMeal}
              disabled={loading}
              className="rounded-full bg-[#E53927] px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Thinking…" : "Propose tonight's pot"}
            </button>
          </div>
          {voiceTranscript && (
            <p className="text-xs text-zinc-600">
              Voice transcript{lastTranscribeEngine ? ` (${lastTranscribeEngine})` : ""}: {voiceTranscript}
            </p>
          )}
          {error && <p className="rounded-lg bg-[#E97B77]/20 px-3 py-2 text-sm text-[#671912]">{error}</p>}
          <KitchenProgress active={loading && !run?.proposal} />
        </section>

        <section className="space-y-4">
          {hydrating && (
            <p className="text-center text-sm text-zinc-500">Loading saved household…</p>
          )}
          {runHistory.length > 0 && (
            <label className="block text-sm text-[#2E4742]">
              Recent pots
              <select
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={run?.id ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) void loadRunById(id);
                }}
              >
                <option value="">Select a past run…</option>
                {runHistory.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.proposal?.title ?? "Run"} · {runStatusLabelKitchen(r.status)} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
          )}
          {run && (
            <p className="rounded-lg bg-white/80 px-3 py-2 font-mono text-xs text-[#3D5F58]">
              Status: {runStatusLabelKitchen(run.status)}
            </p>
          )}
          {!run?.proposal && !loading && (
            <div className="rounded-2xl border border-dashed border-[#3D5F58]/40 bg-white/60 p-8 text-center text-sm text-zinc-600">
              Proposal appears here. Gemma uses open weights; approve before ElevenLabs narrates.
            </div>
          )}
          {run?.approvalQuestion && (
            <p className="rounded-xl bg-[#8BB2DE]/20 px-4 py-3 text-sm text-[#2E4742]">
              {run.approvalQuestion}
            </p>
          )}
          {run?.proposal && run.preferenceScore !== undefined && (
            <div className="rounded-xl bg-[#F5B726]/20 px-4 py-3 text-sm text-[#231F20]">
              <p className="font-semibold">
                Friend fit score: {run.preferenceScore}/100
                {run.predictionSource ? ` · ${run.predictionSource}` : ""}
              </p>
              {run.fitReasons?.map((r) => (
                <p key={r} className="mt-1 text-xs text-zinc-700">{r}</p>
              ))}
            </div>
          )}
          {run?.serpInspiration && run.serpInspiration.length > 0 && (
            <ul className="rounded-xl bg-white p-4 text-xs text-zinc-700">
              <p className="font-semibold text-[#2E4742]">SerpApi meal ideas</p>
              {run.serpInspiration.map((n) => (
                <li key={n} className="mt-1 list-disc pl-4">{n}</li>
              ))}
            </ul>
          )}
          {run?.shoppingNotes && run.shoppingNotes.length > 0 && (
            <ul className="rounded-xl bg-white p-4 text-xs text-zinc-700">
              <p className="font-semibold text-[#2E4742]">Shopping & SerpApi hints</p>
              {run.shoppingNotes.map((n) => (
                <li key={n} className="mt-1 list-disc pl-4">{n}</li>
              ))}
            </ul>
          )}
          {run?.proposal && (
            <>
              <RecipeCard recipe={run.proposal} />
              <button
                type="button"
                onClick={copyRecipe}
                className="text-sm font-medium text-[#3D5F58] underline"
              >
                {copiedRecipe ? "Copied!" : `Copy recipe for ${cookName}`}
              </button>
            </>
          )}
          {showApproveActions && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => approve(true, true)}
                disabled={loading}
                className="w-full rounded-full bg-[#3D5F58] py-3 text-sm font-semibold text-white"
              >
                Approve & read aloud
              </button>
              <div className="flex gap-3">
              <button
                type="button"
                onClick={() => approve(true)}
                disabled={loading}
                className="flex-1 rounded-full border border-[#3D5F58] py-3 text-sm font-semibold text-[#3D5F58]"
              >
                Approve only
              </button>
              <button
                type="button"
                onClick={() => approve(false)}
                disabled={loading}
                className="rounded-full border border-zinc-400 px-5 py-3 text-sm"
              >
                Not tonight
              </button>
              </div>
            </div>
          )}
          {showNarrateActions && run.status !== "narrated" && (
            <button
              type="button"
              onClick={narrate}
              disabled={loading}
              className="w-full rounded-full bg-[#F5B726] py-3 text-sm font-semibold text-[#231F20]"
            >
              {run.status === "failed" ? "Retry narration (ElevenLabs)" : "Read recipe aloud (ElevenLabs)"}
            </button>
          )}
          {audioUrl && (
            <audio controls className="w-full" src={audioUrl}>
              Your browser does not support audio playback.
            </audio>
          )}
          {(run?.status === "narrated" || run?.status === "approved") && (
            <div className="rounded-xl bg-white p-4">
              <label className="block text-sm font-medium text-[#2E4742]">
                What did {cookName} say? (saved to Mongo memory)
                <textarea
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Too spicy / loved it / make again Thursday…"
                />
              </label>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={loading || !feedback.trim()}
                className="mt-2 rounded-full bg-[#E53927] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Save friend feedback
              </button>
              {run.cookFeedback && (
                <p className="mt-2 text-xs text-zinc-600">Last: {run.cookFeedback}</p>
              )}
            </div>
          )}
          {pantryMemories.length > 0 && (
            <details className="rounded-xl bg-white p-4 text-xs text-zinc-600">
              <summary className="cursor-pointer font-mono text-[#3D5F58]">
                Pantry memory ({pantryMemories.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {pantryMemories.slice(0, 8).map((m) => (
                  <li key={m.id} className="border-l-2 border-[#8BB2DE] pl-2">
                    {m.text}
                    <span className="text-zinc-400"> · {m.tags.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {run?.trace && (
            <details className="rounded-xl bg-white p-4 text-xs text-zinc-600">
              <summary className="cursor-pointer font-mono text-[#3D5F58]">Agent trace (Sentry-ready)</summary>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadTrace}
                  className="text-[#3D5F58] underline"
                >
                  Trace JSON (Sentry)
                </button>
                <button
                  type="button"
                  onClick={downloadEntire}
                  className="text-[#3D5F58] underline"
                >
                  Entire export
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {run.trace.map((t) => (
                  <li key={`${t.at}-${t.step}`}>
                    [{t.step}] {t.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </main>
      <IntegrationsPanel />
      <footer className="border-t border-[#3D5F58]/15 px-6 py-6 text-center text-xs text-zinc-600">
        <a
          className="font-medium text-[#3D5F58] underline"
          href="https://github.com/smriad/house-pot"
          target="_blank"
          rel="noreferrer"
        >
          house-pot on GitHub
        </a>
        <span className="mx-2">·</span>
        Hacktoberfest Weekend — Build for a Friend
      </footer>
    </div>
  );
}
