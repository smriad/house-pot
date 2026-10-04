import type { Metadata } from "next";
import AllPotHistoryPage from "@/components/AllPotHistoryPage";

export const metadata: Metadata = {
  title: "All pot history",
  description:
    "Browse every House Pot run on this server — all households, newest first.",
  alternates: { canonical: "/history/all" },
};

export default function AllHistoryRoute() {
  return <AllPotHistoryPage />;
}
