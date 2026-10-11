import { cacheLife } from "next/cache";

const FINMIND_API = "https://api.finmindtrade.com/api/v4/data";

type FinMindResponse<T> = {
  msg: string;
  status: number;
  data: T[];
};

// 所有 FinMind dataset 共用：帶 token、檢查錯誤、快取
async function fetchDataset<T>(
  dataset: string,
  code: string,
  startDate: string,
): Promise<T[]> {
  "use cache";
  cacheLife("hours");

  const url = new URL(FINMIND_API);
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("data_id", code);
  url.searchParams.set("start_date", startDate);

  // token 選填：沒設定時使用 FinMind 匿名額度
  const token = process.env.FINMIND_TOKEN;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const body: FinMindResponse<T> = await res.json();
  if (!res.ok || body.status !== 200) {
    throw new Error(`FinMind ${dataset} 回應錯誤：${body.msg ?? res.status}`);
  }
  return body.data;
}

/* ---------- 股價日線 ---------- */

type FinMindPriceRow = {
  date: string;
  stock_id: string;
  Trading_Volume: number;
  Trading_money: number;
  open: number;
  max: number;
  min: number;
  close: number;
  spread: number;
  Trading_turnover: number;
};

export type PricePoint = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // 股
};

export async function getFinMindHistory(
  code: string,
  startDate: string,
): Promise<PricePoint[]> {
  const rows = await fetchDataset<FinMindPriceRow>("TaiwanStockPrice", code, startDate);
  return rows.map((row) => ({
    date: row.date,
    open: row.open,
    high: row.max,
    low: row.min,
    close: row.close,
    volume: row.Trading_Volume,
  }));
}

/* ---------- 籌碼面 ---------- */

type InstitutionalRow = {
  date: string;
  stock_id: string;
  name:
    | "Foreign_Investor"
    | "Foreign_Dealer_Self"
    | "Investment_Trust"
    | "Dealer_self"
    | "Dealer_Hedging";
  buy: number;
  sell: number;
};

type MarginRow = {
  date: string;
  MarginPurchaseTodayBalance: number;
  MarginPurchaseYesterdayBalance: number;
  ShortSaleTodayBalance: number;
  ShortSaleYesterdayBalance: number;
};

type ShareholdingRow = {
  date: string;
  ForeignInvestmentSharesRatio: number;
};

// 三大法人買賣超，單位：張（買進 - 賣出，正數為買超）
export type InstitutionalNet = {
  date: string;
  foreign: number;
  trust: number;
  dealer: number;
  total: number;
};

export type MarginPoint = {
  date: string;
  marginBalance: number; // 融資餘額（張）
  shortBalance: number; // 融券餘額（張）
};

export type ForeignHoldingPoint = {
  date: string;
  ratio: number; // 外資持股比例（%）
};

export type ChipData = {
  institutional: InstitutionalNet[];
  margin: MarginPoint[];
  foreignHolding: ForeignHoldingPoint[];
};

const toLots = (shares: number) => Math.round(shares / 1000);

export async function getFinMindChips(
  code: string,
  startDate: string,
): Promise<ChipData> {
  const [inst, margin, holding] = await Promise.all([
    fetchDataset<InstitutionalRow>("TaiwanStockInstitutionalInvestorsBuySell", code, startDate),
    fetchDataset<MarginRow>("TaiwanStockMarginPurchaseShortSale", code, startDate),
    fetchDataset<ShareholdingRow>("TaiwanStockShareholding", code, startDate),
  ]);

  const byDate = new Map<string, InstitutionalNet>();
  for (const row of inst) {
    const day =
      byDate.get(row.date) ??
      { date: row.date, foreign: 0, trust: 0, dealer: 0, total: 0 };
    const net = row.buy - row.sell;
    if (row.name.startsWith("Foreign")) day.foreign += net;
    else if (row.name === "Investment_Trust") day.trust += net;
    else day.dealer += net;
    byDate.set(row.date, day);
  }

  const institutional = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      foreign: toLots(d.foreign),
      trust: toLots(d.trust),
      dealer: toLots(d.dealer),
      total: toLots(d.foreign + d.trust + d.dealer),
    }));

  return {
    institutional,
    margin: margin.map((r) => ({
      date: r.date,
      marginBalance: r.MarginPurchaseTodayBalance,
      shortBalance: r.ShortSaleTodayBalance,
    })),
    foreignHolding: holding.map((r) => ({
      date: r.date,
      ratio: r.ForeignInvestmentSharesRatio,
    })),
  };
}
