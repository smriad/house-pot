"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

type IntegrationStatus = {
  gemma: { configured: boolean; live: boolean };
  mongodb: { configured: boolean; reachable: boolean; vectorIndex: boolean };
  elevenlabs: { configured: boolean; live: boolean; tts: boolean; stt: boolean };
  serpapi: { configured: boolean; live: boolean };
  whisper: { live: boolean; note: string };
  mastra: { enabled: boolean; storageLive: boolean };
  sentry: { configured: boolean };
  temporal: { configured: boolean; reachable: boolean };
  embeddings: { live: boolean };
  freeFood: { meals: boolean; facts: boolean };
  backboard: { configured: boolean; reachable: boolean };
  tabpfn: { live: boolean; note: string };
  tiger: { configured: boolean; reachable: boolean };
  deploy: {
    render: boolean;
    digitalOcean: boolean;
    githubActions: boolean;
    entireExport: boolean;
  };
  storage: "mongodb" | "local-json";
};

type Row = {
  name: string;
  track?: string;
  ok: boolean;
  detail: string;
  hint?: string;
};

function rowsFromStatus(s: IntegrationStatus): Row[] {
  return [
    {
      name: "Gemma (open weights)",
      track: "Featured · Gemma",
      ok: s.gemma.live,
      detail: s.gemma.live ? "Model endpoint reachable" : "Demo recipe mode",
      hint: "ollama pull gemma3:4b",
    },
    {
      name: "MongoDB Atlas",
      track: "MongoDB",
      ok: s.mongodb.reachable,
      detail: s.mongodb.reachable
        ? s.mongodb.vectorIndex
          ? "Connected · vector index configured"
          : "Connected · keyword + embedding rank"
        : s.storage === "local-json"
          ? "Using .data/house-pot.json"
          : "URI set but unreachable",
      hint: "MONGODB_URI",
    },
    {
      name: "Backboard memory",
      track: "Backboard",
      ok: s.backboard.reachable,
      detail: s.backboard.configured
        ? s.backboard.reachable
          ? "Semantic cook memories"
          : "Check API key + assistant id"
        : "Optional cross-thread memory",
      hint: "BACKBOARD_API_KEY",
    },
    {
      name: "ElevenLabs",
      track: "ElevenLabs",
      ok: s.elevenlabs.live,
      detail: s.elevenlabs.live
        ? "TTS + Scribe API verified"
        : s.elevenlabs.configured
          ? "Key set but TTS probe failed (check Text to Speech access + voice ID)"
          : "Narration disabled",
      hint: "ELEVENLABS_API_KEY",
    },
    {
      name: "Whisper",
      track: "Open STT",
      ok: s.whisper.live,
      detail: s.whisper.note,
      hint: "pip install -r requirements.txt",
    },
    {
      name: "SerpApi",
      track: "SerpApi",
      ok: s.serpapi.live,
      detail: s.serpapi.live
        ? "Substitute research live"
        : s.serpapi.configured
          ? "Key invalid or quota"
          : "Skipped",
      hint: "SERPAPI_API_KEY",
    },
    {
      name: "Mastra",
      track: "Mastra",
      ok: s.mastra.storageLive,
      detail: s.mastra.storageLive
        ? "Approval workflow + LibSQL storage"
        : "Workflow gate (storage on first run)",
    },
    {
      name: "TabPFN",
      track: "Featured · Prior Labs",
      ok: s.tabpfn.live,
      detail: s.tabpfn.note,
      hint: "pip install -r requirements-tabpfn.txt",
    },
    {
      name: "Tiger Data",
      track: "Tiger Data",
      ok: s.tiger.reachable,
      detail: s.tiger.configured
        ? s.tiger.reachable
          ? "Postgres feedback mirror"
          : "TIGER_DATABASE_URL unreachable"
        : "Optional Postgres memory",
      hint: "TIGER_DATABASE_URL",
    },
    {
      name: "Temporal",
      track: "Temporal",
      ok: s.temporal.reachable,
      detail: s.temporal.reachable
        ? "Durable narration worker (local)"
        : s.temporal.configured
          ? "Start docker + worker on your machine"
          : "Optional — not deployed on Render",
      hint: "Local: npm run temporal:up · UI http://localhost:8233",
    },
    {
      name: "Sentry",
      track: "Agent tracing",
      ok: s.sentry.configured,
      detail: s.sentry.configured ? "Spans on agent steps" : "In-app trace only",
      hint: "SENTRY_DSN",
    },
    {
      name: "Embeddings",
      track: "Ollama",
      ok: s.embeddings.live,
      detail: s.embeddings.live
        ? "Pantry memory vectors (Ollama or Google text-embedding-004)"
        : "Keyword memory only",
      hint: "ollama pull nomic-embed-text · or AI Studio GEMMA_API_KEY",
    },
    {
      name: "TheMealDB",
      track: "Free, no key",
      ok: s.freeFood.meals,
      detail: s.freeFood.meals
        ? "Public dish names ground the planner"
        : "Meal name lookup unreachable",
    },
    {
      name: "Open Food Facts",
      track: "Free, no key",
      ok: s.freeFood.facts,
      detail: s.freeFood.facts
        ? "Hidden allergen tags + protein per 100g"
        : "Nutrition lookup unreachable",
    },
    {
      name: "Render deploy",
      track: "Featured · Render",
      ok: s.deploy.render,
      detail: s.deploy.render ? "render.yaml + /api/health" : "Missing render.yaml",
    },
    {
      name: "DigitalOcean",
      track: "Featured · DO",
      ok: s.deploy.digitalOcean,
      detail: s.deploy.digitalOcean ? ".do/app.yaml ready" : "Add App Platform spec",
    },
    {
      name: "GitHub Actions",
      track: "GitHub Copilot / CI",
      ok: s.deploy.githubActions,
      detail: s.deploy.githubActions
        ? "CI build on push"
        : "Add workflow (use Copilot locally for agent builds)",
    },
    {
      name: "Entire export",
      track: "Entire",
      ok: s.deploy.entireExport,
      detail: "Download Entire JSON per run (/api/runs/:id/entire)",
    },
  ];
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

export default function IntegrationsPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const localDev = useSyncExternalStore(
    () => () => {},
    isLocalDevHost,
    () => false,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const json = await res.json();
      setStatus(json as IntegrationStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const rows = status ? rowsFromStatus(status) : [];
  const liveCount = rows.filter((r) => r.ok).length;

  return (
    <section className="border-t border-hp-sage/25 bg-hp-sage-deep px-4 py-4 text-hp-cream sm:px-6">
      <div className="hp-container flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm uppercase tracking-widest text-hp-sky">
            Sponsor integrations
          </h2>
          <p className="mt-1 text-xs text-hp-cream/80">
            Local probes only — nothing is submitted from this panel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void refresh();
          }}
          className="min-h-11 rounded-full border border-hp-gold px-4 py-2 font-mono text-xs text-hp-gold touch-manipulation hover:bg-hp-gold/10"
        >
          {open ? "Hide" : "Show"} dashboard
          {status ? ` · ${liveCount}/${rows.length} live` : ""}
        </button>
      </div>

      {open && (
        <div className="hp-container mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && !status && (
            <p className="text-sm text-hp-cream/70">Probing services…</p>
          )}
          {rows.map((row) => (
            <div
              key={row.name}
              className="rounded-2xl border-2 border-hp-cream/20 bg-hp-ink/40 px-4 py-3 shadow-[3px_3px_0_0_rgb(245_183_38_/_0.28)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  {row.track && (
                    <p className="text-[10px] uppercase tracking-wide text-[#8BB2DE]">
                      {row.track}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border border-hp-ink px-2 py-0.5 font-mono text-[10px] ${
                    row.ok ? "bg-hp-gold text-hp-ink" : "bg-hp-blush/40 text-hp-cream"
                  }`}
                >
                  {row.ok ? "live" : "off"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#F2F2EB]/85">{row.detail}</p>
              {row.hint && (
                <p className="mt-1 font-mono text-[10px] text-[#F5B726]/90">{row.hint}</p>
              )}
            </div>
          ))}
          <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="rounded-full bg-[#F5B726] px-4 py-2 text-xs font-semibold text-[#231F20] disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh probes"}
            </button>
            {localDev ? (
              <a
                href="http://localhost:8233"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#F2F2EB]/30 px-4 py-2 text-xs"
              >
                Open Temporal UI (localhost:8233)
              </a>
            ) : (
              <span className="rounded-full border border-[#F2F2EB]/20 px-4 py-2 text-xs text-hp-cream/70">
                Temporal UI is local-only (docker on :8233), not on this server
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
