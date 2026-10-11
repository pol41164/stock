import type { NextRequest } from "next/server";
import { getBuyRankings } from "@/lib/insti-rank";

// GET /api/rankings?limit=50
// 每日外資、投信買超金額排行（上市 + 上櫃，只回傳公司名稱與名次）
export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return Response.json({ error: "limit 需介於 1 到 100" }, { status: 400 });
  }

  try {
    const rankings = await getBuyRankings(limit);
    return Response.json({ ...rankings, source: "證交所 T86、櫃買中心三大法人日報" });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法取得法人買超排行" }, { status: 502 });
  }
}
