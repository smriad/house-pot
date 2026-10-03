"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Household, KitchenRun, PantryMemory, Recipe } from "@/lib/types";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import KitchenProgress from "@/components/KitchenProgress";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
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
    <article className="hp-card ring-1 ring-hp-sage/10">
      <h3 className="text-xl font-semibold tracking-tight text-hp-sage-deep sm:text-2xl">
        {recipe.title}
      </h3>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-zinc-700 sm:text-base">
        {recipe.summary}
      </p>
      {recipe.allergyWarnings.length > 0 && (
        <p
          className="mt-4 rounded-xl border border-hp-blush/30 bg-hp-blush/15 px-3 py-2.5 text-sm text-[#671912]"
          role="alert"
        >
          Allergy watch: {recipe.allergyWarnings.join(", ")}
        </p>
      )}
      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-hp-sage">
        Ingredients
      </h4>
      <ul className="mt-2 space-y-1.5 text-sm text-zinc-800">
        {recipe.ingredients.map((ing) => (
          <li key={`${ing.item}-${ing.amount}`} className="flex gap-2 border-b border-zinc-100 py-1.5 last:border-0">
            <span className="shrink-0 font-mono text-xs text-hp-sage">{ing.amount}</span>
            <span>
              {ing.item}
              {ing.substitute ? (
                <span className="text-zinc-500"> (or {ing.substitute})</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-hp-sage">
        Steps
      </h4>
      <ol className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-800">
        {recipe.steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hp-sage/10 font-mono text-xs font-semibold text-hp-sage-deep">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">
        {recipe.openSourceRationale}
      </p>
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
    void (async () => {
      try {
        if (!id) return;
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
    <div className="hp-page">
      <SiteHeader
        title="Build for a Friend"
        subtitle={`Open-weight Gemma plans the meal from what is in the kitchen. MongoDB remembers the pantry. ElevenLabs reads the recipe aloud only after ${cookName || "your cook"} taps approve.`}
      >
        <Link href="/history" className="hp-btn-gold">
          Pot history
        </Link>
      </SiteHeader>

      {health && (
        <p className="hp-container -mt-1 pb-2 font-mono text-[10px] leading-relaxed text-hp-sage sm:text-xs">
          gemma:{String(health.gemma)} · {String(health.storage ?? "local")} · elevenlabs:
          {health.elevenlabs ? "tts" : "off"}
          {health.elevenlabsStt ? "+scribe" : ""} · temporal:
          {health.temporal ? "on" : "off"} · embed:
          {health.embeddings ? "on" : "off"} · serp:{health.serpapi ? "on" : "off"}
        </p>
      )}

      <main className="hp-container grid flex-1 gap-8 py-8 sm:py-10 lg:grid-cols-2 lg:gap-10">
        <section className="space-y-4 sm:space-y-5" aria-labelledby="cook-profile-heading">
          <h2 id="cook-profile-heading" className="hp-section-title">
            Who are you cooking for?
          </h2>
          <label className="hp-label">
            Cook&apos;s name
            <input
              className="hp-input"
              autoComplete="name"
              value={cookName}
              onChange={(e) => setCookName(e.target.value)}
            />
          </label>
          <label className="hp-label">
            Allergies (comma-separated)
            <input
              className="hp-input"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </label>
          <label className="hp-label">
            Dislikes (comma-separated)
            <input
              className="hp-input"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="very spicy, cilantro…"
            />
          </label>
          <label className="hp-label">
            Diners
            <input
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              className="hp-input w-28"
              value={diners}
              onChange={(e) => setDiners(Number(e.target.value))}
            />
          </label>
          <label className="hp-label">
            Pantry & voice notes
            <textarea
              rows={6}
              className="hp-textarea"
              value={pantry}
              onChange={(e) => setPantry(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={recording ? stopWhisperRecording : startWhisperRecording}
              className="hp-btn-sage hp-btn-block sm:w-auto sm:flex-1"
            >
              {recording ? "Stop recording" : "Record pantry"}
            </button>
            <button
              type="button"
              onClick={startListening}
              disabled={listening}
              className="hp-btn-outline hp-btn-block sm:w-auto"
            >
              {listening ? "Listening…" : "Browser speech"}
            </button>
            <button
              type="button"
              onClick={proposeMeal}
              disabled={loading}
              className="hp-btn-primary hp-btn-block sm:w-auto sm:min-w-[12rem]"
            >
              {loading ? "Thinking…" : "Propose tonight's pot"}
            </button>
          </div>
          {voiceTranscript && (
            <p className="text-xs text-zinc-600">
              Voice transcript{lastTranscribeEngine ? ` (${lastTranscribeEngine})` : ""}: {voiceTranscript}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-hp-blush/40 bg-hp-blush/15 px-3 py-2.5 text-sm text-[#671912]" role="alert">
              {error}
            </p>
          )}
          <KitchenProgress active={loading && !run?.proposal} />
        </section>

        <section className="space-y-4 sm:space-y-5" aria-labelledby="proposal-heading">
          <h2 id="proposal-heading" className="hp-section-title lg:sr-only">
            Tonight&apos;s proposal
          </h2>
          {hydrating && (
            <p className="text-center text-sm text-zinc-500">Loading saved household…</p>
          )}
          {runHistory.length > 0 && (
            <label className="hp-label">
              Recent pots
              <select
                className="hp-input"
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
            <p className="hp-chip bg-hp-sage/10 font-mono text-hp-sage-deep">
              {runStatusLabelKitchen(run.status)}
            </p>
          )}
          {!run?.proposal && !loading && (
            <div className="hp-empty">
              Proposal appears here. Gemma uses open weights; approve before ElevenLabs narrates.
            </div>
          )}
          {run?.approvalQuestion && (
            <p className="rounded-xl border border-hp-sky/30 bg-hp-sky/15 px-4 py-3 text-pretty text-sm text-hp-sage-deep">
              {run.approvalQuestion}
            </p>
          )}
          {run?.proposal && run.preferenceScore !== undefined && (
            <div className="rounded-xl border border-hp-gold/35 bg-hp-gold/20 px-4 py-3 text-sm text-hp-ink">
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
            <ul className="hp-card text-xs text-zinc-700">
              <p className="font-semibold text-hp-sage-deep">SerpApi meal ideas</p>
              {run.serpInspiration.map((n) => (
                <li key={n} className="mt-1 list-disc pl-4">{n}</li>
              ))}
            </ul>
          )}
          {run?.shoppingNotes && run.shoppingNotes.length > 0 && (
            <ul className="hp-card text-xs text-zinc-700">
              <p className="font-semibold text-hp-sage-deep">Shopping & SerpApi hints</p>
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
                className="text-sm font-semibold text-hp-sage underline decoration-hp-sage/30 underline-offset-2"
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
                className="hp-btn-sage hp-btn-block"
              >
                Approve & read aloud
              </button>
              <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => approve(true)}
                disabled={loading}
                className="hp-btn-outline hp-btn-block flex-1"
              >
                Approve only
              </button>
              <button
                type="button"
                onClick={() => approve(false)}
                disabled={loading}
                className="hp-btn-ghost hp-btn-block sm:w-auto"
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
              className="hp-btn-gold hp-btn-block"
            >
              {run.status === "failed" ? "Retry narration (ElevenLabs)" : "Read recipe aloud (ElevenLabs)"}
            </button>
          )}
          {audioUrl && (
            <audio controls className="w-full rounded-xl" src={audioUrl} preload="metadata">
              Your browser does not support audio playback.
            </audio>
          )}
          {(run?.status === "narrated" || run?.status === "approved") && (
            <div className="hp-card">
              <label className="hp-label">
                What did {cookName} say? (saved to Mongo memory)
                <textarea
                  rows={3}
                  className="hp-textarea mt-2 min-h-[5rem]"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Too spicy / loved it / make again Thursday…"
                />
              </label>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={loading || !feedback.trim()}
                className="hp-btn-primary mt-3 disabled:opacity-50"
              >
                Save friend feedback
              </button>
              {run.cookFeedback && (
                <p className="mt-2 text-xs text-zinc-600">Last: {run.cookFeedback}</p>
              )}
            </div>
          )}
          {pantryMemories.length > 0 && (
            <details className="hp-card text-xs text-zinc-600">
              <summary className="cursor-pointer font-mono font-medium text-hp-sage">
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
            <details className="hp-card text-xs text-zinc-600">
              <summary className="cursor-pointer font-mono font-medium text-hp-sage">Agent trace (Sentry-ready)</summary>
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
      <SiteFooter />
    </div>
  );
}
