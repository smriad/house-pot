const STEPS = [
  "Mastra approval gate",
  "Backboard & pantry memory",
  "Gemma recipe draft",
  "TabPFN friend-fit score",
  "Shopping hints",
];

export default function KitchenProgress({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="hp-card border-hp-sage/20" role="status" aria-live="polite">
      <p className="hp-display text-2xl text-hp-sage-deep">Kitchen agent working…</p>
      <p className="mt-1 text-pretty text-xs text-zinc-600 sm:text-sm">
        First TabPFN run can take 1–2 minutes on a cold start. Keep this tab open.
      </p>
      <ul className="mt-4 space-y-2.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-xs text-zinc-700 sm:text-sm">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-hp-gold motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 0.35}s` }}
            />
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-hp-sage/15">
        <div className="h-full w-1/3 rounded-full bg-hp-sage motion-safe:animate-[kitchen-bar_2.4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
