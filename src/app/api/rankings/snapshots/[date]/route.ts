import type { NextRequest } from "next/server";
import type { BuyRankings } from "@/lib/insti-rank";
import { connectDB } from "@/lib/mongodb";
import { RankingSnapshot } from "@/models/RankingSnapshot";

// GET /api/rankings/snapshots/2026-10-12：讀取某天儲存的排行（格式同 /api/rankings）
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/rankings/snapshots/[date]">) {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "日期格式需為 YYYY-MM-DD" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await RankingSnapshot.findOne({ date }).lean();
    if (!doc) {
      return Response.json({ error: `沒有 ${date} 的排行紀錄` }, { status: 404 });
    }
    const rankings: BuyRankings = {
      date: doc.date,
      foreign: doc.foreign,
      trust: doc.trust,
      markets: doc.markets as BuyRankings["markets"],
    };
    return Response.json(rankings);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法讀取排行紀錄" }, { status: 500 });
  }
}
