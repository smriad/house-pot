"use client";

import Link from "next/link";
import type { KitchenRun } from "@/lib/types";
import {
  runStatusClasses,
  runStatusDetail,
  runStatusLabel,
} from "@/lib/kitchen/run-display";

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

export type RunHistoryListItem = KitchenRun & { cookName?: string };

type RunHistoryListProps = {
  runs: RunHistoryListItem[];
  showHousehold?: boolean;
};

export function RunHistoryList({ runs, showHousehold }: RunHistoryListProps) {
  return (
    <ul className="space-y-4">
      {runs.map((run) => (
        <li
          key={run.id}
          className="hp-card transition-shadow hover:shadow-md hover:shadow-hp-sage/10"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {showHousehold && run.cookName && (
                <p className="mb-1 font-mono text-xs font-semibold text-hp-gold">
                  {run.cookName}
                  <span className="font-normal text-zinc-500">
                    {" · "}
                    <Link
                      href={`/history?household=${encodeURIComponent(run.householdId)}`}
                      className="underline hover:text-hp-sage-deep"
                    >
                      this household
                    </Link>
                  </span>
                </p>
              )}
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
  );
}
