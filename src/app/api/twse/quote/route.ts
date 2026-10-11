import type { NextRequest } from "next/server";
import { getTwseQuote } from "@/lib/twse";

// GET /api/twse/quote?code=2330
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "2330";
  if (!/^\w{4,6}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const quote = await getTwseQuote(code);
    if (!quote) {
      return Response.json({ error: `找不到股票 ${code}` }, { status: 404 });
    }
    return Response.json(quote);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法取得 TWSE 報價" }, { status: 502 });
  }
}
