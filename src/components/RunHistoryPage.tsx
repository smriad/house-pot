"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Household, KitchenRun, RunStatus } from "@/lib/types";
import {
  runStatusClasses,
  runStatusDetail,
  runStatusLabel,
} from "@/lib/kitchen/run-display";

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
  const [hasHouseholdId, setHasHouseholdId] = useState(false);

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
    setHasHouseholdId(!!localStorage.getItem(STORAGE_KEY));
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return runs;
    return runs.filter((r) => r.status === filter);
  }, [runs, filter]);

  return (
    <div className="min-h-full bg-[#F2F2EB] text-[#231F20]">
      <header className="border-b border-[#3D5F58]/20 bg-[#3D5F58] px-6 py-8 text-[#F2F2EB]">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8BB2DE]">House Pot</p>
        <h1 className="mt-2 font-mono text-3xl font-semibold">Pot history</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#F2F2EB]/90">
          Every propose → approve → narrate run for your household, newest first.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-[#F5B726] px-5 py-2 text-sm font-semibold text-[#231F20]"
          >
            Back to kitchen
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-[#F2F2EB]/40 px-5 py-2 text-sm font-medium text-[#F2F2EB] disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {!hasHouseholdId && !loading && (
          <p className="rounded-2xl border border-dashed border-[#3D5F58]/40 bg-white/70 p-8 text-center text-sm text-zinc-600">
            No household saved yet.{" "}
            <Link href="/" className="font-medium text-[#3D5F58] underline">
              Open the kitchen
            </Link>{" "}
            and propose a meal first.
          </p>
        )}

        {household && (
          <p className="mb-6 font-mono text-sm text-[#3D5F58]">
            Cooking for <span className="font-semibold">{household.cookName}</span>
            {" · "}
            {runs.length} run{runs.length === 1 ? "" : "s"} stored
          </p>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                filter === s
                  ? "bg-[#3D5F58] text-white"
                  : "bg-white text-[#3D5F58] ring-1 ring-[#3D5F58]/20"
              }`}
            >
              {s === "all" ? "All" : runStatusLabel(s)}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-[#E97B77]/20 px-3 py-2 text-sm text-[#671912]">
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
            <li
              key={run.id}
              className="rounded-2xl border border-[#3D5F58]/15 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#2E4742]">
                    {run.proposal?.title ?? "Run (no recipe yet)"}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{formatWhen(run.createdAt)}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${runStatusClasses(run.status)}`}
                  title={runStatusDetail(run.status)}
                >
                  {runStatusLabel(run.status)}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 font-mono text-xs text-zinc-600">
                {run.pantryText}
              </p>

              <dl className="mt-4 grid gap-2 text-xs text-zinc-700 sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-[#3D5F58]">Diners</dt>
                  <dd>{run.diners}</dd>
                </div>
                {run.preferenceScore !== undefined && (
                  <div>
                    <dt className="font-semibold text-[#3D5F58]">Friend fit</dt>
                    <dd>
                      {run.preferenceScore}/100
                      {run.predictionSource ? ` · ${run.predictionSource}` : ""}
                    </dd>
                  </div>
                )}
                {run.cookFeedback && (
                  <div className="sm:col-span-3">
                    <dt className="font-semibold text-[#3D5F58]">Cook said</dt>
                    <dd className="mt-0.5 italic">{run.cookFeedback}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-100 pt-4">
                <Link
                  href={`/?run=${run.id}`}
                  className="rounded-full bg-[#E53927] px-4 py-2 text-sm font-medium text-white"
                >
                  Open in kitchen
                </Link>
                <a
                  href={`/api/runs/${run.id}/trace`}
                  className="rounded-full border border-[#3D5F58]/30 px-4 py-2 text-sm text-[#3D5F58]"
                  target="_blank"
                  rel="noreferrer"
                >
                  Trace JSON
                </a>
                <span className="self-center font-mono text-[10px] text-zinc-400">
                  {run.id.slice(0, 8)}…
                </span>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
