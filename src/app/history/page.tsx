import type { Metadata } from "next";
import RunHistoryPage from "@/components/RunHistoryPage";

export const metadata: Metadata = {
  title: "Pot history",
  description:
    "Browse past House Pot runs — recipes proposed, approved, narrated, and friend feedback saved to pantry memory.",
  alternates: { canonical: "/history" },
};

export default function HistoryRoute() {
  return <RunHistoryPage />;
}
