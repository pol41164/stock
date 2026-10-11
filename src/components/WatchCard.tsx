"use client";

import { useEffect, useState } from "react";
import type { RealtimeQuote } from "@/lib/twse-mis";
import type { PricePoint } from "@/lib/finmind";
import { fmtPrice, getJson } from "@/lib/client";
import type { AiState } from "@/hooks/useAiAnalysis";
import { ChangePill, FlashValue, Skeleton } from "./ui";
import { SparkIcon, VERDICT_STYLE } from "./AiAnalysisPanel";

// 卡片底部顯示最近一次 AI 判讀結果
function AiBadge({ state }: { state: AiState }) {
  if (state.status === "ok") {
    const v = state.data.verdict;
    return (
      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${VERDICT_STYLE[v]}`}>
        {v === "利多" ? "▲ " : v === "利空" ? "▼ " : ""}
        {v}
        <span className="ml-1 font-normal opacity-70">信心{state.data.confidence}</span>
      </span>
    );
  }
  if (state.status === "loading") {
    return <span className="h-4 w-16 animate-pulse rounded bg-grid" aria-label="AI 分析中" />;
  }
  if (state.status === "error") {
    return <span className="truncate text-[11px] text-up" title={state.message}>分析失敗</span>;
  }
  return <span className="text-[11px] text-muted">尚未分析</span>;
}

export default function WatchCard({
  code,
  name,
  quote,
  selected,
  onSelect,
  onRemove,
  ai,
  onAnalyze,
}: {
  code: string;
  name: string;
  quote?: RealtimeQuote;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  ai: AiState;
  onAnalyze: () => void;
}) {
  const [closes, setCloses] = useState<number[]>([]);

  useEffect(() => {
    getJson<{ prices: PricePoint[] }>(`/api/finmind/history?code=${code}&days=60`)
      .then((body) => setCloses(body.prices.map((p) => p.close)))
      .catch(() => setCloses([]));
  }, [code]);

  // 走勢小圖最後一點接上即時價
  const series = quote && closes.length ? [...closes, quote.price] : closes;
  const trendUp = series.length > 1 ? series.at(-1)! >= series[0] : true;

  return (
    <div
      className={`group relative w-48 shrink-0 overflow-hidden rounded-xl border bg-surface transition-all sm:w-auto ${
        selected
          ? "border-accent/60 shadow-pop ring-1 ring-accent/40"
          : "border-border shadow-card hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop"
      }`}
    >
      {selected && <div className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}

      <button onClick={onSelect} aria-pressed={selected} className="flex w-full flex-col p-3.5 text-left">
        <div className="flex items-center gap-2 pr-6">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="font-mono text-[11px] text-muted">{code}</span>
        </div>

        {quote ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <FlashValue value={quote.price} className="text-lg font-semibold tracking-tight tabular-nums">
              {fmtPrice(quote.price)}
            </FlashValue>
            <ChangePill change={quote.change} percent={quote.changePercent} size="sm" />
          </div>
        ) : (
          <Skeleton className="mt-2 h-7" />
        )}

        <Sparkline values={series} up={trendUp} id={code} />
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2">
        <AiBadge state={ai} />
        <button
          onClick={onAnalyze}
          disabled={ai.status === "loading"}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft disabled:opacity-50"
        >
          <SparkIcon />
          {ai.status === "loading" ? "分析中…" : ai.status === "ok" ? "重新分析" : "AI 分析"}
        </button>
      </div>

      <button
        onClick={onRemove}
        aria-label={`從追蹤清單移除 ${name}`}
        title="移除"
        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-md text-muted transition-all hover:bg-up-soft hover:text-up sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function Sparkline({ values, up, id }: { values: number[]; up: boolean; id: string }) {
  const W = 160;
  const H = 40;
  if (values.length < 2) return <div className="mt-2" style={{ height: H }} />;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (H - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const color = up ? "var(--price-up)" : "var(--price-down)";
  const gid = `spark-${id}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-10 w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
