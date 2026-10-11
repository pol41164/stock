import { cacheLife } from "next/cache";

const TWSE_STOCK_DAY_ALL =
  "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";

type TwseDayRow = {
  Date: string;
  Code: string;
  Name: string;
  TradeVolume: string;
  TradeValue: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
  Transaction: string;
};

export type StockQuote = {
  code: string;
  name: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number; // 股
  source: "TWSE";
};

// 民國年日期 "1151008" -> "2026-10-08"
function rocToIsoDate(roc: string): string {
  const year = Number(roc.slice(0, -4)) + 1911;
  return `${year}-${roc.slice(-4, -2)}-${roc.slice(-2)}`;
}

function toNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}

export async function getTwseQuote(code: string): Promise<StockQuote | null> {
  "use cache";
  cacheLife("minutes");

  const res = await fetch(TWSE_STOCK_DAY_ALL);
  if (!res.ok) {
    throw new Error(`TWSE OpenAPI 回應 ${res.status}`);
  }

  const rows: TwseDayRow[] = await res.json();
  const row = rows.find((r) => r.Code === code);
  if (!row) return null;

  const close = toNumber(row.ClosingPrice);
  const change = toNumber(row.Change);
  const prevClose = close - change;

  return {
    code: row.Code,
    name: row.Name,
    date: rocToIsoDate(row.Date),
    open: toNumber(row.OpeningPrice),
    high: toNumber(row.HighestPrice),
    low: toNumber(row.LowestPrice),
    close,
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    volume: toNumber(row.TradeVolume),
    source: "TWSE",
  };
}
