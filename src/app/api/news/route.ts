import type { NextRequest } from "next/server";
import { getYahooNews } from "@/lib/yahoo-news";

// GET /api/news?code=2330
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "2330";
  if (!/^\w{4,6}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const news = await getYahooNews(code);
    return Response.json({ code, news, source: "Yahoo股市" });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法取得新聞" }, { status: 502 });
  }
}
