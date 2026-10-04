"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RunStatus } from "@/lib/types";
import { runStatusLabel } from "@/lib/kitchen/run-display";
import { RunHistoryList, type RunHistoryListItem } from "@/components/RunHistoryList";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const PAGE_SIZE = 50;

const STATUS_FILTERS: Array<RunStatus | "all"> = [
  "all",
  "awaiting_approval",
  "narrated",
  "approved",
  "failed",
];

export default function AllPotHistoryPage() {
  const [runs, setRuns] = useState<RunHistoryListItem[]>([]);
  const [filter, setFilter] = useState<RunStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (skip: number, append: boolean) => {
    const res = await fetch(`/api/pots?limit=${PAGE_SIZE}&skip=${skip}`);
    if (!res.ok) throw new Error("Could not load pot history");
    const j = (await res.json()) as {
      runs: RunHistoryListItem[];
      hasMore: boolean;
    };
    setHasMore(j.hasMore);
    setRuns((prev) => (append ? [...prev, ...j.runs] : j.runs));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchPage(0, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRuns([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage(runs.length, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, runs.length]);

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
        title="All pot history"
        subtitle="Every propose → approve → narrate run across all households on this server, newest first."
      >
        <Link href="/history" className="hp-btn-gold">
          My household
        </Link>
        <Link href="/" className="hp-btn border-2 border-hp-cream bg-transparent text-hp-cream shadow-[3px_3px_0_0_rgb(242_242_235_/_0.45)] hover:bg-hp-cream/10">
          Kitchen
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="hp-btn border-2 border-hp-cream bg-transparent text-hp-cream shadow-[3px_3px_0_0_rgb(242_242_235_/_0.45)] hover:bg-hp-cream/10 disabled:opacity-50"
        >
          {loading && runs.length > 0 ? "Refreshing…" : "Refresh"}
        </button>
      </SiteHeader>

      <main className="hp-container max-w-4xl flex-1 py-8 sm:py-10">
        <p className="mb-6 font-mono text-sm text-hp-sage">
          {loading && runs.length === 0
            ? "Loading…"
            : `${runs.length} run${runs.length === 1 ? "" : "s"} loaded`}
          {hasMore ? " · more available" : ""}
        </p>

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
          <p
            className="mb-4 rounded-xl border border-hp-blush/40 bg-hp-blush/15 px-3 py-2.5 text-sm text-[#671912]"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading && runs.length === 0 && (
          <p className="text-center text-sm text-zinc-500">Loading all pots…</p>
        )}

        {!loading && filtered.length === 0 && runs.length > 0 && (
          <p className="text-center text-sm text-zinc-500">No runs match this filter.</p>
        )}

        {!loading && runs.length === 0 && !error && (
          <p className="hp-empty">No runs on this server yet. Propose a pot from the kitchen first.</p>
        )}

        <RunHistoryList runs={filtered} showHousehold />

        {hasMore && filter === "all" && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="hp-btn-primary min-w-[12rem] disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

        {hasMore && filter !== "all" && (
          <p className="mt-6 text-center text-xs text-zinc-500">
            Load more uses unfiltered pages—switch to <strong>All</strong> to fetch older runs.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
