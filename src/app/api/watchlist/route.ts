import { connectDB } from "@/lib/mongodb";
import { getRealtimeQuotes } from "@/lib/twse-mis";
import { WatchItem } from "@/models/WatchItem";

// 即時報價 API 一次最多查 20 檔
const MAX_ITEMS = 20;

export type WatchlistEntry = { code: string; name: string; market: "tse" | "otc" };

const toEntry = (d: { code: string; name: string; market: string }): WatchlistEntry => ({
  code: d.code,
  name: d.name,
  market: d.market as WatchlistEntry["market"],
});

// GET /api/watchlist：取得追蹤清單（依加入順序）
export async function GET() {
  try {
    await connectDB();
    const items = await WatchItem.find().sort({ createdAt: 1 }).lean();
    return Response.json({ items: items.map(toEntry) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法讀取追蹤清單" }, { status: 500 });
  }
}

// POST /api/watchlist { code }：加入一檔股票
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!/^\w{4,6}$/.test(code)) {
    return Response.json({ error: "請輸入 4–6 碼的股票代號" }, { status: 400 });
  }

  try {
    await connectDB();

    if (await WatchItem.exists({ code })) {
      return Response.json({ error: `${code} 已經在追蹤清單中` }, { status: 409 });
    }
    if ((await WatchItem.countDocuments()) >= MAX_ITEMS) {
      return Response.json({ error: `追蹤清單最多 ${MAX_ITEMS} 檔` }, { status: 400 });
    }

    // 用證交所即時報價確認代號存在，順便取得名稱與市場別
    const [quote] = await getRealtimeQuotes([code]);
    if (!quote) {
      return Response.json({ error: `找不到股票代號 ${code}` }, { status: 404 });
    }

    const item = await WatchItem.create({ code, name: quote.name, market: quote.market });
    return Response.json({ item: toEntry(item) }, { status: 201 });
  } catch (err) {
    // 同時送出兩次時，由唯一索引擋下
    if ((err as { code?: number }).code === 11000) {
      return Response.json({ error: `${code} 已經在追蹤清單中` }, { status: 409 });
    }
    console.error(err);
    return Response.json({ error: "無法加入追蹤清單" }, { status: 500 });
  }
}
