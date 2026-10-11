import { cacheLife } from "next/cache";

// 外資／投信買超金額排行，全部使用官方公開資料計算：
// - 上市：證交所「三大法人買賣超日報」(T86) × 證交所 OpenAPI 每日收盤價
// - 上櫃：櫃買中心 OpenAPI 三大法人日報 × 每日收盤價
// 買超金額 = 買賣超股數 × 當日收盤價（估算值）
const TWSE_T86 = "https://www.twse.com.tw/rwd/zh/fund/T86";
const TWSE_CLOSE = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_INSTI = "https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading";
const TPEX_CLOSE = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";

const HEADERS = { "User-Agent": "Mozilla/5.0 (my-stock dashboard)" };

export type RankItem = { rank: number; name: string };

export type BuyRankings = {
  date: string | null; // YYYY-MM-DD
  foreign: RankItem[];
  trust: RankItem[];
  markets: ("上市" | "上櫃")[]; // 實際有納入計算的市場
};

type NetRow = {
  name: string;
  foreignShares: number; // 外資（含陸資、含外資自營商）買賣超股數
  trustShares: number; // 投信買賣超股數
  close: number;
};

const toNum = (v: string | undefined) => Number(String(v ?? "").replace(/,/g, "").trim());

// 只保留一般公司股票：4 碼、不以 0 開頭（排除 ETF、權證等）
const isCompany = (code: string) => /^[1-9]\d{3}$/.test(code.trim());

// 民國年 "1151008" -> "2026-10-08"
const rocToIso = (roc: string) => `${Number(roc.slice(0, -4)) + 1911}-${roc.slice(-4, -2)}-${roc.slice(-2)}`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${new URL(url).hostname} 回應 ${res.status}`);
  return res.json();
}

/* ---------- 上市（證交所） ---------- */

async function getTwseRows(): Promise<{ date: string; rows: NetRow[] }> {
  // 先拿收盤價，用它的日期去查同一天的 T86，確保兩者日期一致
  const closes = await getJson<{ Date: string; Code: string; ClosingPrice: string }[]>(TWSE_CLOSE);
  if (!closes.length) throw new Error("證交所收盤價沒有資料");
  const date = rocToIso(closes[0].Date);
  const closeMap = new Map(closes.map((c) => [c.Code.trim(), toNum(c.ClosingPrice)]));

  const t86 = await getJson<{ stat: string; fields?: string[]; data?: string[][] }>(
    `${TWSE_T86}?date=${date.replaceAll("-", "")}&selectType=ALLBUT0999&response=json`,
  );
  if (t86.stat !== "OK" || !t86.fields || !t86.data) throw new Error(`證交所 T86：${t86.stat}`);

  // 依欄位名稱找位置，避免欄位順序變動
  const col = (name: string) => {
    const i = t86.fields!.findIndex((f) => f.startsWith(name));
    if (i < 0) throw new Error(`證交所 T86 找不到欄位：${name}`);
    return i;
  };
  const iCode = col("證券代號");
  const iName = col("證券名稱");
  const iForeign = col("外陸資買賣超股數(不含外資自營商)");
  const iForeignDealer = col("外資自營商買賣超股數");
  const iTrust = col("投信買賣超股數");

  const rows = t86.data
    .filter((r) => isCompany(r[iCode]) && closeMap.has(r[iCode].trim()))
    .map((r) => ({
      name: r[iName].trim(),
      foreignShares: toNum(r[iForeign]) + toNum(r[iForeignDealer]),
      trustShares: toNum(r[iTrust]),
      close: closeMap.get(r[iCode].trim())!,
    }));

  return { date, rows };
}

/* ---------- 上櫃（櫃買中心） ---------- */

// 櫃買 OpenAPI 的欄位名稱夾雜多餘空白，比對時去掉空白
const pick = (row: Record<string, string>, key: string) =>
  row[Object.keys(row).find((k) => k.replace(/\s/g, "") === key) ?? ""];

async function getTpexRows(): Promise<{ date: string; rows: NetRow[] }> {
  const [insti, closes] = await Promise.all([
    getJson<Record<string, string>[]>(TPEX_INSTI),
    getJson<{ Date: string; SecuritiesCompanyCode: string; Close: string }[]>(TPEX_CLOSE),
  ]);
  if (!insti.length || !closes.length) throw new Error("櫃買中心沒有資料");

  const date = rocToIso(insti[0].Date);
  if (rocToIso(closes[0].Date) !== date) throw new Error("櫃買中心法人與收盤價日期不一致");
  const closeMap = new Map(closes.map((c) => [c.SecuritiesCompanyCode.trim(), toNum(c.Close)]));

  const rows = insti
    .filter((r) => isCompany(r.SecuritiesCompanyCode) && closeMap.has(r.SecuritiesCompanyCode.trim()))
    .map((r) => ({
      name: r.CompanyName.trim(),
      foreignShares: toNum(pick(r, "ForeignInvestorsIncludeMainlandAreaInvestors-Difference")),
      trustShares: toNum(pick(r, "SecuritiesInvestmentTrustCompanies-Difference")),
      close: closeMap.get(r.SecuritiesCompanyCode.trim())!,
    }));

  return { date, rows };
}

/* ---------- 排行 ---------- */

function rank(rows: NetRow[], field: "foreignShares" | "trustShares", limit: number): RankItem[] {
  return rows
    .map((r) => ({ name: r.name, amount: r[field] * r.close }))
    .filter((r) => Number.isFinite(r.amount) && r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, name: r.name }));
}

export async function getBuyRankings(limit = 50): Promise<BuyRankings> {
  "use cache";
  // 盤後每日更新一次，快取 1 小時即可
  cacheLife("hours");

  const [twse, tpex] = await Promise.allSettled([getTwseRows(), getTpexRows()]);
  if (twse.status === "rejected" && tpex.status === "rejected") {
    throw new Error(`上市、上櫃資料都取得失敗：${(twse.reason as Error).message}`);
  }

  // 以上市日期為準；上櫃日期不同就不混在一起排
  const date = twse.status === "fulfilled" ? twse.value.date : (tpex as PromiseFulfilledResult<{ date: string }>).value.date;
  const parts: { market: "上市" | "上櫃"; rows: NetRow[] }[] = [];
  if (twse.status === "fulfilled") parts.push({ market: "上市", rows: twse.value.rows });
  if (tpex.status === "fulfilled" && tpex.value.date === date) parts.push({ market: "上櫃", rows: tpex.value.rows });

  const rows = parts.flatMap((p) => p.rows);
  return {
    date,
    foreign: rank(rows, "foreignShares", limit),
    trust: rank(rows, "trustShares", limit),
    markets: parts.map((p) => p.market),
  };
}
