import type { KitchenRun } from "@/lib/types";

/** Strip narration blob before sending runs to list/history clients. */
export function summarizeRunForApi(run: KitchenRun) {
  const { audioBase64: _, ...rest } = run;
  void _;
  return rest;
}

/** All-pots / history list — trace and brain load via `/api/runs/:id` and `/trace`. */
export function summarizeRunForList(run: KitchenRun) {
  const {
    audioBase64: _a,
    trace: _t,
    kitchenBrain: _k,
    voiceTranscript: _v,
    serpInspiration: _s,
    ...rest
  } = run;
  void _a;
  void _t;
  void _k;
  void _v;
  void _s;
  return rest;
}
