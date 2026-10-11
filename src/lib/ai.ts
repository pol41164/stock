import { getFinMindChips, getFinMindHistory } from "@/lib/finmind";
import { getRealtimeQuotes } from "@/lib/twse-mis";
import { getYahooNews } from "@/lib/yahoo-news";
import type { AiAnalysis, AiModelId } from "@/lib/ai-models";

const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const pct = (from: number, to: number) => +(((to - from) / from) * 100).toFixed(2);

// 在後端整理這檔股票目前的資訊，前端只需要傳代號
export async function buildStockContext(code: string) {
  const [quotes, history, chips, news] = await Promise.allSettled([
    getRealtimeQuotes([code]),
    getFinMindHistory(code, daysAgo(120)),
    getFinMindChips(code, daysAgo(45)),
    getYahooNews(code),
  ]);

  const quote = quotes.status === "fulfilled" ? quotes.value[0] : undefined;
  if (!quote) {
    throw new AiError(`找不到股票 ${code} 的即時資訊`, 404);
  }

  const prices = history.status === "fulfilled" ? history.value : [];
  const closes = prices.map((p) => p.close);
  const ma = (n: number) =>
    closes.length >= n ? +(closes.slice(-n).reduce((a, b) => a + b, 0) / n).toFixed(2) : null;

  const chip = chips.status === "fulfilled" ? chips.value : null;
  const inst = chip?.institutional ?? [];
  const sumInst = (k: "foreign" | "trust" | "dealer" | "total", n: number) =>
    inst.slice(-n).reduce((acc, d) => acc + d[k], 0);

  return {
    股票: { 代號: quote.code, 名稱: quote.name, 市場: quote.market === "tse" ? "上市" : "上櫃" },
    即時報價: {
      資料時間: quote.time,
      現價: quote.price,
      昨收: quote.prevClose,
      漲跌: +quote.change.toFixed(2),
      漲跌幅百分比: +quote.changePercent.toFixed(2),
      開盤: quote.open,
      最高: quote.high,
      最低: quote.low,
      成交量張: quote.volume,
      委買五檔總量張: quote.bids.reduce((s, b) => s + b.volume, 0),
      委賣五檔總量張: quote.asks.reduce((s, a) => s + a.volume, 0),
    },
    技術面:
      closes.length > 1
        ? {
            近5日報酬百分比: closes.length > 5 ? pct(closes.at(-6)!, closes.at(-1)!) : null,
            近20日報酬百分比: closes.length > 20 ? pct(closes.at(-21)!, closes.at(-1)!) : null,
            近60日報酬百分比: closes.length > 60 ? pct(closes.at(-61)!, closes.at(-1)!) : null,
            MA5: ma(5),
            MA20: ma(20),
            MA60: ma(60),
            近60日最高: Math.max(...closes.slice(-60)),
            近60日最低: Math.min(...closes.slice(-60)),
            近10日收盤: prices.slice(-10).map((p) => ({ 日期: p.date, 收盤: p.close, 成交量張: Math.round(p.volume / 1000) })),
          }
        : "無資料",
    籌碼面: chip
      ? {
          三大法人近5日買賣超張: {
            外資: sumInst("foreign", 5),
            投信: sumInst("trust", 5),
            自營商: sumInst("dealer", 5),
            合計: sumInst("total", 5),
          },
          三大法人近20日買賣超張: {
            外資: sumInst("foreign", 20),
            投信: sumInst("trust", 20),
            自營商: sumInst("dealer", 20),
            合計: sumInst("total", 20),
          },
          融資餘額張: chip.margin.slice(-5).map((m) => ({ 日期: m.date, 融資: m.marginBalance, 融券: m.shortBalance })),
          外資持股比例: chip.foreignHolding.slice(-5).map((h) => ({ 日期: h.date, 比例: h.ratio })),
        }
      : "無資料",
    近期新聞: news.status === "fulfilled"
      ? news.value.slice(0, 12).map((n) => ({ 時間: n.publishedAt, 標題: n.title, 摘要: n.summary.slice(0, 120) }))
      : "無資料",
  };
}

const POINT = {
  type: "object",
  properties: {
    title: { type: "string", description: "一句話重點，20 字以內" },
    detail: { type: "string", description: "具體說明，引用提供資料中的數字或新聞" },
  },
  required: ["title", "detail"],
  additionalProperties: false,
};

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["利多", "利空", "中性"] },
    confidence: { type: "string", enum: ["低", "中", "高"] },
    summary: { type: "string", description: "80 字以內的總結" },
    bullish: { type: "array", items: POINT, description: "利多因素，最多 4 點" },
    bearish: { type: "array", items: POINT, description: "利空因素，最多 4 點" },
  },
  required: ["verdict", "confidence", "summary", "bullish", "bearish"],
  additionalProperties: false,
};

const INSTRUCTIONS = `你是台股分析助理。根據使用者提供的單一股票 JSON 資料（即時報價、技術面、籌碼面、近期新聞），判斷目前整體偏「利多」、「利空」或「中性」，並列出理由。
規則：
- 只能根據提供的資料推論，不要編造資料中沒有的數字、事件或新聞。
- 每個理由都要具體引用資料（例如：外資近 5 日賣超 12,000 張、股價跌破 MA20、某則新聞標題）。
- 資料不足或多空訊號互相矛盾時，判斷為「中性」並把信心度設為「低」。
- 這是短期市場情緒判讀，不是投資建議；不要給買賣指示或目標價。
- 全部使用繁體中文。`;

type ResponsesOutput = {
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
};

export async function analyzeStock(apiKey: string, model: AiModelId, code: string): Promise<AiAnalysis> {
  const context = await buildStockContext(code);

  const res = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content: JSON.stringify(context) }],
      text: {
        format: { type: "json_schema", name: "stock_sentiment", schema: SCHEMA, strict: true },
      },
      store: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const body: ResponsesOutput = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    // 把 OpenAI 的錯誤轉成使用者看得懂的訊息（不回傳 key）
    if (res.status === 401) throw new AiError(`OpenAI API Key 無效，請到設定重新輸入（OpenAI：${msg}）`, 401);
    if (res.status === 429) throw new AiError(`OpenAI 額度不足或請求太頻繁：${msg}`, 429);
    if (res.status === 404) throw new AiError(`你的帳號無法使用模型 ${model}：${msg}`, 400);
    throw new AiError(`OpenAI 回應錯誤：${msg}`, 502);
  }

  if (body.status === "incomplete") {
    throw new AiError(`AI 回應不完整（${body.incomplete_details?.reason ?? "未知原因"}），請再試一次`, 502);
  }

  const parts = body.output?.find((o) => o.type === "message")?.content ?? [];
  const refusal = parts.find((p) => p.type === "refusal")?.refusal;
  if (refusal) throw new AiError(`AI 拒絕回答：${refusal}`, 502);

  const text = parts.find((p) => p.type === "output_text")?.text;
  if (!text) throw new AiError("AI 沒有回傳內容", 502);

  const parsed = JSON.parse(text) as Omit<AiAnalysis, "model" | "generatedAt" | "dataAsOf">;
  return {
    ...parsed,
    bullish: parsed.bullish.slice(0, 4),
    bearish: parsed.bearish.slice(0, 4),
    model,
    generatedAt: new Date().toISOString(),
    dataAsOf: context.即時報價.資料時間,
  };
}
