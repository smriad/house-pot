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
    <div
      className="rounded-2xl border border-[#3D5F58]/25 bg-white/90 p-5 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="font-mono text-sm font-semibold text-[#2E4742]">Kitchen agent working…</p>
      <p className="mt-1 text-xs text-zinc-600">
        First TabPFN run can take 1–2 minutes on a cold start. Keep this tab open.
      </p>
      <ul className="mt-4 space-y-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-xs text-zinc-700">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#F5B726] motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 0.35}s` }}
            />
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#3D5F58]/15">
        <div className="h-full w-1/3 rounded-full bg-[#3D5F58] motion-safe:animate-[kitchen-bar_2.4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
