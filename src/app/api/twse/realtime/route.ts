import type { NextRequest } from "next/server";
import { getRealtimeQuotes } from "@/lib/twse-mis";

const MAX_CODES = 20;

// GET /api/twse/realtime?codes=2330,2317,2454
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("codes") ?? "2330";
  const codes = [...new Set(raw.split(",").map((c) => c.trim()).filter(Boolean))];

  if (!codes.length || codes.length > MAX_CODES || !codes.every((c) => /^\w{4,6}$/.test(c))) {
    return Response.json(
      { error: `codes 需為 1 到 ${MAX_CODES} 個以逗號分隔的股票代號` },
      { status: 400 },
    );
  }

  try {
    const quotes = await getRealtimeQuotes(codes);
    return Response.json({ quotes });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法取得即時報價" }, { status: 502 });
  }
}
