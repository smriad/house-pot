"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Household, KitchenRun, RunStatus } from "@/lib/types";
import {
  runStatusClasses,
  runStatusDetail,
  runStatusLabel,
} from "@/lib/kitchen/run-display";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const STORAGE_KEY = "house-pot-household-id";

const STATUS_FILTERS: Array<RunStatus | "all"> = [
  "all",
  "awaiting_approval",
  "narrated",
  "approved",
  "failed",
];

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function RunHistoryPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [runs, setRuns] = useState<KitchenRun[]>([]);
  const [filter, setFilter] = useState<RunStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const householdId = localStorage.getItem(STORAGE_KEY);
    if (!householdId) {
      setHousehold(null);
      setRuns([]);
      setLoading(false);
      return;
    }
    try {
      const [hRes, rRes] = await Promise.all([
        fetch(`/api/household?id=${encodeURIComponent(householdId)}`),
        fetch(`/api/household/${householdId}/runs?limit=50`),
      ]);
      if (hRes.ok) setHousehold((await hRes.json()) as Household);
      if (!rRes.ok) throw new Error("Could not load run history");
      const j = (await rRes.json()) as { runs: KitchenRun[] };
      setRuns(j.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return runs;
    return runs.filter((r) => r.status === filter);
  }, [runs, filter]);

  return (
    <div className="hp-page">
      <SiteHeader
        title="Pot history"
        subtitle="Every propose → approve → narrate run for your household, newest first."
      >
        <Link href="/" className="hp-btn-gold">
          Back to kitchen
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="hp-btn border-2 border-hp-cream bg-transparent text-hp-cream shadow-[3px_3px_0_0_rgb(242_242_235_/_0.45)] hover:bg-hp-cream/10 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </SiteHeader>

      <main className="hp-container max-w-4xl flex-1 py-8 sm:py-10">
        {!loading && !household && runs.length === 0 && (
          <p className="hp-empty">
            No household saved yet.{" "}
            <Link href="/" className="font-semibold text-hp-sage underline">
              Open the kitchen
            </Link>{" "}
            and propose a meal first.
          </p>
        )}

        {household && (
          <p className="mb-6 font-mono text-sm text-hp-sage">
            Cooking for <span className="font-semibold text-hp-sage-deep">{household.cookName}</span>
            {" · "}
            {runs.length} run{runs.length === 1 ? "" : "s"} stored
          </p>
        )}

        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={filter === s}
              onClick={() => setFilter(s)}
              className={`min-h-9 touch-manipulation rounded-full border-2 border-hp-ink px-4 py-1.5 font-display text-sm font-bold ${
                filter === s
                  ? "bg-hp-gold text-hp-ink shadow-[2px_2px_0_0_var(--hp-ink)]"
                  : "bg-white text-hp-sage-deep hover:bg-hp-sky/30"
              }`}
            >
              {s === "all" ? "All" : runStatusLabel(s)}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-hp-blush/40 bg-hp-blush/15 px-3 py-2.5 text-sm text-[#671912]" role="alert">
            {error}
          </p>
        )}

        {loading && runs.length === 0 && (
          <p className="text-center text-sm text-zinc-500">Loading history…</p>
        )}

        {!loading && filtered.length === 0 && household && (
          <p className="text-center text-sm text-zinc-500">No runs match this filter.</p>
        )}

        <ul className="space-y-4">
          {filtered.map((run) => (
            <li key={run.id} className="hp-card transition-shadow hover:shadow-md hover:shadow-hp-sage/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="hp-display text-2xl text-hp-sage-deep sm:text-3xl">
                    {run.proposal?.title ?? "Run (no recipe yet)"}
                  </h2>
                  <time className="mt-1 block text-xs text-zinc-500" dateTime={run.createdAt}>
                    {formatWhen(run.createdAt)}
                  </time>
                </div>
                <span
                  className={`hp-chip shrink-0 ${runStatusClasses(run.status)}`}
                  title={runStatusDetail(run.status)}
                >
                  {runStatusLabel(run.status)}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 font-mono text-xs text-zinc-600">{run.pantryText}</p>

              <dl className="mt-4 grid gap-3 text-xs text-zinc-700 sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-hp-sage">Diners</dt>
                  <dd className="mt-0.5">{run.diners}</dd>
                </div>
                {run.preferenceScore !== undefined && (
                  <div>
                    <dt className="font-semibold text-hp-sage">Friend fit</dt>
                    <dd className="mt-0.5">
                      {run.preferenceScore}/100
                      {run.predictionSource ? ` · ${run.predictionSource}` : ""}
                    </dd>
                  </div>
                )}
                {run.cookFeedback && (
                  <div className="sm:col-span-3">
                    <dt className="font-semibold text-hp-sage">Cook said</dt>
                    <dd className="mt-0.5 italic">{run.cookFeedback}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href={`/?run=${run.id}`} className="hp-btn-primary text-center">
                  Open in kitchen
                </Link>
                <a
                  href={`/api/runs/${run.id}/trace`}
                  className="hp-btn-outline text-center"
                  target="_blank"
                  rel="noreferrer"
                >
                  Trace JSON
                </a>
                <span className="font-mono text-[10px] text-zinc-400 sm:ml-auto">
                  {run.id.slice(0, 8)}…
                </span>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
