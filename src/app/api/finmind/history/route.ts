import type { NextRequest } from "next/server";
import { getFinMindHistory } from "@/lib/finmind";

const MAX_DAYS = 365 * 5;

// GET /api/finmind/history?code=2330&days=365
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code") ?? "2330";
  const days = Number(params.get("days") ?? 365);

  if (!/^\w{4,6}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return Response.json(
      { error: `days 需介於 1 到 ${MAX_DAYS}` },
      { status: 400 },
    );
  }

  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().slice(0, 10);

  try {
    const prices = await getFinMindHistory(code, startDate);
    return Response.json({ code, startDate, prices, source: "FinMind" });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法取得 FinMind 歷史資料" }, { status: 502 });
  }
}
