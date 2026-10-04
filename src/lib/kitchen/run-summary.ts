import type { KitchenRun } from "@/lib/types";

/** Strip large fields before sending runs to the client. */
export function summarizeRunForApi(run: KitchenRun) {
  const { audioBase64: _, ...rest } = run;
  void _;
  return rest;
}
