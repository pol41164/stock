import { cacheLife } from "next/cache";

// 證交所「基本市況報導」即時報價（非正式 API，上市、上櫃皆可查）
const MIS_API = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

type MisRow = {
  c: string; // 代號
  n: string; // 名稱
  ex: "tse" | "otc";
  z: string; // 最新成交價（該次快照無成交時為 "-"）
  pz?: string; // 前一筆成交價
  y: string; // 昨收
  o: string;
  h: string;
  l: string;
  u: string; // 漲停價
  w: string; // 跌停價
  v: string; // 累積成交量（張）
  a: string; // 委賣價（五檔，"_" 分隔）
  f: string; // 委賣量
  b: string; // 委買價
  g: string; // 委買量
  tlong: string; // 資料時間（毫秒）
};

export type OrderLevel = { price: number; volume: number };

export type RealtimeQuote = {
  code: string;
  name: string;
  market: "tse" | "otc";
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  limitUp: number;
  limitDown: number;
  volume: number; // 張
  asks: OrderLevel[];
  bids: OrderLevel[];
  time: string; // ISO
  source: "TWSE MIS";
};

const num = (v?: string) => {
  const n = Number(v);
  return v && v !== "-" && Number.isFinite(n) ? n : NaN;
};

function levels(prices: string, volumes: string): OrderLevel[] {
  const p = prices.split("_").filter(Boolean);
  const v = volumes.split("_").filter(Boolean);
  return p
    .map((price, i) => ({ price: num(price), volume: num(v[i]) }))
    .filter((l) => l.price > 0);
}

// 一次查詢多檔，依傳入順序回傳；查不到的代號會被略過
export async function getRealtimeQuotes(codes: string[]): Promise<RealtimeQuote[]> {
  "use cache";
  // 同一組股票最多每 5 秒向證交所請求一次，避免被擋
  cacheLife({ revalidate: 5, expire: 60 });

  // 不確定上市或上櫃，兩個一起查，只有存在的那一個會有資料
  const exCh = codes.flatMap((c) => [`tse_${c}.tw`, `otc_${c}.tw`]).join("|");
  const res = await fetch(`${MIS_API}?ex_ch=${exCh}&json=1&delay=0`);
  if (!res.ok) {
    throw new Error(`TWSE MIS 回應 ${res.status}`);
  }

  const body: { msgArray?: MisRow[]; rtcode: string } = await res.json();
  const rows = body.msgArray ?? [];
  return codes.flatMap((code) => {
    const row = rows.find((r) => r.c === code);
    return row ? [toQuote(row)] : [];
  });
}

function toQuote(row: MisRow): RealtimeQuote {
  const asks = levels(row.a, row.f);
  const bids = levels(row.b, row.g);
  const prevClose = num(row.y);
  // 剛好沒有成交的快照：依序退回前一筆成交價、最佳買價、昨收
  const price = [num(row.z), num(row.pz), bids[0]?.price, prevClose].find(
    (v) => Number.isFinite(v) && v > 0,
  )!;
  const change = price - prevClose;

  return {
    code: row.c,
    name: row.n,
    market: row.ex,
    price,
    prevClose,
    change,
    changePercent: (change / prevClose) * 100,
    open: num(row.o),
    high: num(row.h),
    low: num(row.l),
    limitUp: num(row.u),
    limitDown: num(row.w),
    volume: num(row.v),
    asks,
    bids,
    time: new Date(Number(row.tlong)).toISOString(),
    source: "TWSE MIS",
  };
}
