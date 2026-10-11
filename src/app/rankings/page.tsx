import type { Metadata } from "next";
import RankingsView from "@/components/RankingsView";

export const metadata: Metadata = {
  title: "法人買超排行 · 我的股票摘要站",
};

export default function RankingsPage() {
  return <RankingsView />;
}
