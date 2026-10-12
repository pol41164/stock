import { getBuyRankings } from "@/lib/insti-rank";
import { connectDB } from "@/lib/mongodb";
import { RankingSnapshot } from "@/models/RankingSnapshot";

export type SnapshotSummary = { date: string; markets: string[]; savedAt: string };

// GET /api/rankings/snapshots：已儲存的排行（新到舊，只列日期）
export async function GET() {
  try {
    await connectDB();
    const docs = await RankingSnapshot.find({}, { date: 1, markets: 1, updatedAt: 1 }).sort({ date: -1 }).lean();
    const items: SnapshotSummary[] = docs.map((d) => ({
      date: d.date,
      markets: d.markets,
      savedAt: d.updatedAt.toISOString(),
    }));
    return Response.json({ items });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法讀取已儲存的排行" }, { status: 500 });
  }
}

// POST /api/rankings/snapshots：儲存目前的排行（前 50 名），同一交易日再存一次會覆蓋
export async function POST() {
  try {
    // 由後端重新取得排行，不信任前端送來的內容
    const rankings = await getBuyRankings(50);
    if (!rankings.date) {
      return Response.json({ error: "目前沒有可儲存的排行" }, { status: 404 });
    }

    await connectDB();
    const doc = await RankingSnapshot.findOneAndUpdate(
      { date: rankings.date },
      { foreign: rankings.foreign, trust: rankings.trust, markets: rankings.markets },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();

    const item: SnapshotSummary = { date: doc.date, markets: doc.markets, savedAt: doc.updatedAt.toISOString() };
    return Response.json({ item }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法儲存排行" }, { status: 500 });
  }
}
