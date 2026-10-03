"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Household, KitchenRun, PantryMemory, Recipe } from "@/lib/types";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import KitchenProgress from "@/components/KitchenProgress";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { cookApprovedRun, runStatusLabel } from "@/lib/kitchen/run-display";
import { reviewProposal, type PantryReview } from "@/lib/kitchen/pantry-check";

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

function RecipeCard({ recipe, review }: { recipe: Recipe; review: PantryReview }) {
  return (
    <article className="hp-card ring-1 ring-hp-sage/10">
      <h3 className="hp-display text-2xl text-hp-sage-deep sm:text-3xl">
        {recipe.title}
      </h3>
      <p className="mt-1.5 text-pretty text-sm leading-snug text-zinc-700">
        {recipe.summary}
      </p>
      {review.allergyHits.length > 0 && (
        <p
          className="mt-4 rounded-xl border-2 border-hp-ink bg-hp-blush/25 px-3 py-2.5 text-sm text-hp-maroon"
          role="alert"
        >
          This pot includes {review.allergyHits.join(", ")}. House Pot will not read it aloud.
        </p>
      )}
      {review.allergyHits.length === 0 && recipe.allergyWarnings.length > 0 && (
        <p className="mt-4 rounded-xl border border-hp-blush/30 bg-hp-blush/15 px-3 py-2.5 text-sm text-hp-maroon">
          Allergy watch: {recipe.allergyWarnings.join(", ")}
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-hp-sage">
            Ingredients
          </h4>
          <ul className="mt-1.5 space-y-1 text-sm text-zinc-800">
            {recipe.ingredients.map((ing, index) => {
              const check = review.ingredients[index];
              return (
                <li
                  key={`${ing.item}-${ing.amount}`}
                  className="flex flex-wrap items-baseline gap-1.5 border-b border-zinc-100 py-1 last:border-0"
                >
                  <span className="shrink-0 font-mono text-[10px] text-hp-sage sm:text-xs">
                    {ing.amount}
                  </span>
                  <span className="min-w-0 flex-1">
                    {ing.item}
                    {ing.substitute ? (
                      <span className="text-zinc-500"> (or {ing.substitute})</span>
                    ) : null}
                  </span>
                  {check?.allergyHit ? (
                    <span className="hp-chip bg-hp-blush/40 text-hp-maroon text-[10px]">
                      allergy
                    </span>
                  ) : check && !check.onHand ? (
                    <span className="hp-chip bg-hp-sky/40 text-hp-sage-deep text-[10px]">
                      missing
                    </span>
                  ) : check?.onHand && !check.staple ? (
                    <span className="hp-chip bg-hp-gold/50 text-hp-ink text-[10px]">
                      in kitchen
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-hp-sage">
            Steps
          </h4>
          <ol className="mt-1.5 space-y-2 text-sm leading-snug text-zinc-800">
            {recipe.steps.map((step, i) => (
              <li key={step} className="flex gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-hp-ink bg-hp-gold font-mono text-[10px] font-semibold text-hp-ink shadow-[2px_2px_0_0_var(--hp-ink)]"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <details className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
        <summary className="cursor-pointer font-medium text-hp-sage">Why this dish</summary>
        <p className="mt-1.5 leading-relaxed">{recipe.openSourceRationale}</p>
      </details>
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
      if (approved) await ensureHousehold();
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

  const allergyList = useMemo(
    () =>
      allergies
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [allergies],
  );
  const pantryReview = useMemo(() => {
    if (!run?.proposal) return null;
    return reviewProposal(run.proposal, run.pantryText, allergyList);
  }, [allergyList, run]);

  const showApproveActions =
    run?.proposal && run.status === "awaiting_approval";
  const showNarrateActions =
    run?.proposal &&
    (run.status === "approved" || (run.status === "failed" && cookApprovedRun(run)));

  const hasPlanningExtras =
    run?.kitchenBrain &&
    (run.kitchenBrain.mealIdeas.length > 0 ||
      run.kitchenBrain.foodFacts.length > 0 ||
      run.kitchenBrain.criticNotes.length > 0);

  return (
    <div className="hp-page">
      <SiteHeader
        compact
        title="Build for a Friend"
        subtitle={`Gemma plans from your pantry. MongoDB remembers allergies. ElevenLabs reads aloud only after ${cookName || "your cook"} approves.`}
      />

      {health && (
        <p className="hp-container border-b border-hp-ink/10 bg-hp-gold/30 px-4 py-1.5 font-mono text-[10px] leading-snug text-hp-sage-deep tabular-nums sm:text-[11px]">
          gemma:{String(health.gemma)} · {String(health.storage ?? "local")} · elevenlabs:
          {health.elevenlabs ? "tts" : "off"}
          {health.elevenlabsStt ? "+scribe" : ""} · temporal:
          {health.temporal ? "on" : "off"} · embed:
          {health.embeddings ? "on" : "off"}
        </p>
      )}

      <main
        className="hp-container grid flex-1 gap-6 py-5 sm:py-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
      >
        <section
          className="space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:pr-1"
          aria-labelledby="cook-profile-heading"
        >
          <h2 id="cook-profile-heading" className="hp-section-title text-xl sm:text-2xl">
            Who are you cooking for?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="hp-label sm:col-span-1">
              Cook&apos;s name
              <input
                className="hp-input"
                autoComplete="name"
                value={cookName}
                onChange={(e) => setCookName(e.target.value)}
              />
            </label>
            <label className="hp-label">
              Diners
              <input
                type="number"
                min={1}
                max={12}
                inputMode="numeric"
                className="hp-input w-full"
                value={diners}
                onChange={(e) => setDiners(Number(e.target.value))}
              />
            </label>
            <label className="hp-label sm:col-span-1">
              Allergies
              <input
                className="hp-input"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="peanuts, shellfish"
              />
            </label>
            <label className="hp-label">
              Dislikes
              <input
                className="hp-input"
                value={dislikes}
                onChange={(e) => setDislikes(e.target.value)}
                placeholder="very spicy…"
              />
            </label>
          </div>
          <label className="hp-label">
            Pantry & voice notes
            <textarea
              rows={3}
              className="hp-textarea min-h-[4.5rem]"
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

        <section className="space-y-3" aria-labelledby="proposal-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="proposal-heading" className="hp-section-title text-xl sm:text-2xl">
              Tonight&apos;s proposal
            </h2>
            <Link
              href="/history"
              className="text-xs font-semibold text-hp-sage underline decoration-hp-sage/30 underline-offset-2"
            >
              Pot history
            </Link>
          </div>
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
            <p className="hp-chip bg-hp-sky/40 text-hp-sage-deep">
              {runStatusLabelKitchen(run.status)}
            </p>
          )}
          {!run?.proposal && !loading && (
            <div className="hp-empty">
              <p className="hp-display text-3xl text-hp-sage-deep">The pot is waiting</p>
              <p className="mx-auto mt-3 max-w-sm">
                Proposal appears here. Gemma uses open weights; approve before ElevenLabs narrates.
              </p>
            </div>
          )}
          {(run?.approvalQuestion || run?.cookBrief) && (
            <div className="space-y-2 text-sm">
              {run.approvalQuestion && (
                <p className="rounded-lg border border-hp-sky/30 bg-hp-sky/15 px-3 py-2 text-pretty text-hp-sage-deep">
                  {run.approvalQuestion}
                </p>
              )}
              {run.cookBrief && (
                <p className="rounded-lg border border-hp-gold/40 bg-hp-gold/20 px-3 py-2 text-pretty italic text-hp-ink">
                  {run.cookBrief}
                </p>
              )}
            </div>
          )}
          {(hasPlanningExtras ||
            (run?.proposal && run.preferenceScore !== undefined) ||
            (run?.serpInspiration && run.serpInspiration.length > 0) ||
            (run?.shoppingNotes && run.shoppingNotes.length > 0)) && (
            <details className="hp-card text-xs text-zinc-700">
              <summary className="cursor-pointer font-semibold text-hp-sage-deep">
                Planning & research (optional)
              </summary>
              <div className="mt-2 space-y-2">
                {run?.proposal && run.preferenceScore !== undefined && (
                  <p className="text-hp-ink">
                    Friend fit {run.preferenceScore}/100
                    {run.predictionSource ? ` · ${run.predictionSource}` : ""}
                    {run.fitReasons?.length ? ` — ${run.fitReasons.join("; ")}` : ""}
                  </p>
                )}
                {hasPlanningExtras && run.kitchenBrain && (
                  <>
                    <p className="font-medium text-hp-sage-deep">
                      Kitchen brain
                      {run.kitchenBrain.revised ? " · revised draft" : ""}
                      {run.kitchenBrain.heat ? ` · ${run.kitchenBrain.heat}` : ""}
                      {run.kitchenBrain.criticModel ? ` · ${run.kitchenBrain.criticModel}` : ""}
                    </p>
                    {run.kitchenBrain.mealIdeas.length > 0 && (
                      <p>TheMealDB: {run.kitchenBrain.mealIdeas.join(" · ")}</p>
                    )}
                    {run.kitchenBrain.foodFacts.length > 0 && (
                      <ul className="space-y-0.5">
                        {run.kitchenBrain.foodFacts.slice(0, 4).map((fact) => (
                          <li key={fact.item}>
                            OFF · {fact.item}
                            {fact.allergens.length ? ` (${fact.allergens.slice(0, 2).join(", ")})` : ""}
                          </li>
                        ))}
                        {run.kitchenBrain.foodFacts.length > 4 && (
                          <li className="text-zinc-500">
                            +{run.kitchenBrain.foodFacts.length - 4} more facts
                          </li>
                        )}
                      </ul>
                    )}
                    {run.kitchenBrain.criticNotes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </>
                )}
                {run?.serpInspiration && run.serpInspiration.length > 0 && (
                  <p>SerpApi: {run.serpInspiration.join(" · ")}</p>
                )}
                {run?.shoppingNotes && run.shoppingNotes.length > 0 && (
                  <p>Shopping: {run.shoppingNotes.join(" · ")}</p>
                )}
              </div>
            </details>
          )}
          {run?.proposal && pantryReview && (
            <>
              <RecipeCard recipe={run.proposal} review={pantryReview} />
              <button
                type="button"
                onClick={copyRecipe}
                className="text-sm font-semibold text-hp-sage underline decoration-hp-sage/30 underline-offset-2"
              >
                {copiedRecipe ? "Copied!" : `Copy recipe for ${cookName}`}
              </button>
            </>
          )}
          {showApproveActions && pantryReview && (
            <div className="flex flex-col gap-2 rounded-xl border border-hp-sage/20 bg-hp-cream/80 p-3">
              <p className="text-xs leading-relaxed text-hp-sage-deep sm:text-sm">
                {pantryReview.safeToNarrate
                  ? pantryReview.missing.length === 0
                    ? "Every ingredient is already in the kitchen."
                    : `Not in the pantry: ${pantryReview.missing.join(", ")}.`
                  : `Reading this aloud stays off because it includes ${pantryReview.allergyHits.join(", ")}.`}
                {" "}
                ElevenLabs speaks only this recipe, and only after you approve.
              </p>
              <button
                type="button"
                onClick={() => approve(true, true)}
                disabled={loading || !pantryReview.safeToNarrate}
                className="hp-btn-sage hp-btn-block"
              >
                Approve & read aloud
              </button>
              <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => approve(true)}
                disabled={loading || !pantryReview.safeToNarrate}
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
              disabled={loading || pantryReview?.safeToNarrate === false}
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
            <div className="hp-card space-y-2 p-3">
              <label className="hp-label text-xs">
                Feedback for {cookName} (Mongo memory)
                <textarea
                  rows={2}
                  className="hp-textarea mt-1 min-h-[3.5rem]"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Too spicy / loved it…"
                />
              </label>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={loading || !feedback.trim()}
                className="hp-btn-primary w-full text-sm disabled:opacity-50 sm:w-auto"
              >
                Save feedback
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
              <summary className="cursor-pointer font-mono font-medium text-hp-sage">
                Agent trace ({run.trace.length} steps)
              </summary>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadTrace}
                  className="text-[#3D5F58] underline"
                >
                  Trace JSON
                </button>
                <button
                  type="button"
                  onClick={downloadEntire}
                  className="text-[#3D5F58] underline"
                >
                  Entire export
                </button>
              </div>
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto font-mono text-[10px] leading-snug sm:text-xs">
                {run.trace.slice(0, 20).map((t) => (
                  <li key={`${t.at}-${t.step}`}>
                    [{t.step}] {t.detail}
                  </li>
                ))}
                {run.trace.length > 20 && (
                  <li className="text-zinc-500">…{run.trace.length - 20} more — download JSON</li>
                )}
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
