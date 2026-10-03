import type { KitchenRun, RunStatus } from "@/lib/types";

export function runStatusLabel(status: RunStatus): string {
  switch (status) {
    case "awaiting_approval":
      return "Awaiting approval";
    case "approved":
      return "Approved";
    case "narrated":
      return "Narrated";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function runStatusDetail(status: RunStatus): string {
  switch (status) {
    case "awaiting_approval":
      return "Cook has not approved yet";
    case "approved":
      return "Ready for ElevenLabs narration";
    case "narrated":
      return "Recipe was read aloud";
    case "failed":
      return "A pipeline step failed — open in kitchen to retry";
    default:
      return "";
  }
}

export function runStatusClasses(status: RunStatus): string {
  switch (status) {
    case "awaiting_approval":
      return "bg-[#8BB2DE]/25 text-[#2E4742]";
    case "approved":
      return "bg-[#F5B726]/30 text-[#231F20]";
    case "narrated":
      return "bg-[#3D5F58]/15 text-[#2E4742]";
    case "failed":
      return "bg-[#E97B77]/20 text-[#671912]";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export function cookApprovedRun(run: KitchenRun): boolean {
  return run.trace.some((t) => t.step === "approve" && t.detail.includes("approved"));
}
