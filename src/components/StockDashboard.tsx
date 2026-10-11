"use client";

import { useEffect, useMemo, useState } from "react";
import type { PricePoint } from "@/lib/finmind";
import type { RealtimeQuote } from "@/lib/twse-mis";
import { getJson, toneClass, type Load } from "@/lib/client";
import { SUGGESTIONS } from "@/lib/watchlist";
import { useRealtimeQuotes } from "@/hooks/useRealtimeQuotes";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAiAnalysis, type AiState } from "@/hooks/useAiAnalysis";
import AddStockForm from "./AddStockForm";
import SiteHeader from "./SiteHeader";
import WatchCard from "./WatchCard";
import { OrderBook, QuoteSummary } from "./QuoteCard";
import PriceChart from "./PriceChart";
import { ChipTiles, InstitutionalPanel, useChips } from "./ChipsSection";
import NewsPanel from "./NewsPanel";
import AiAnalysisPanel from "./AiAnalysisPanel";
import SettingsDialog from "./SettingsDialog";
import { Card, CardHeader, EmptyNote, Segmented, Skeleton } from "./ui";

const RANGES = [
  { value: 30, label: "1M" },
  { value: 90, label: "3M" },
  { value: 180, label: "6M" },
  { value: 365, label: "1Y" },
] as const;

export default function StockDashboard() {
  const { state, add, remove } = useWatchlist();
  const ai = useAiAnalysis();
  const items = state.status === "ok" ? state.items : [];
  const codes = items.map((i) => i.code);

  const [picked, setPicked] = useState<string | null>(null);
  // 選取的股票被移除時，自動改選第一檔
  const selected = picked && codes.includes(picked) ? picked : codes[0];

  const { quotes, error, live, updatedAt } = useRealtimeQuotes(codes);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 卡片上的 AI 分析：選取該檔、呼叫後端，並捲動到 AI 結果卡片
  function handleAnalyze(code: string) {
    if (!ai.hasKey) {
      setSettingsOpen(true);
      return;
    }
    setPicked(code);
    ai.run(code);
    setTimeout(() => document.getElementById("ai-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function handleRemove(code: string) {
    setRemoveError(await remove(code));
  }

  return (
    <>
      <SiteHeader>
        {codes.length > 0 && (
          <div className="hidden items-center gap-3 text-[11px] text-muted md:flex">
            {error && <span className="text-up">更新失敗，顯示上次資料</span>}
            {updatedAt && (
              <span className="tabular-nums">{updatedAt.toLocaleTimeString("zh-TW", { hour12: false })} 更新</span>
            )}
            <MarketBadge live={live} />
          </div>
        )}
        <AddStockForm onAdd={add} />
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="設定"
          title="設定"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-secondary ring-1 ring-border transition-colors hover:text-foreground"
        >
          <GearIcon />
        </button>
      </SiteHeader>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-medium tracking-wider text-muted">追蹤清單</h2>
            <p className="mt-0.5 text-sm text-secondary">
              {state.status === "ok" ? `${codes.length} 檔股票 · 點選卡片查看詳情` : "載入中…"}
            </p>
          </div>
          {codes.length > 0 && (
            <div className="md:hidden">
              <MarketBadge live={live} />
            </div>
          )}
        </div>

        {removeError && <p className="-mt-3 text-sm text-up">{removeError}</p>}

        {state.status === "loading" && (
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[124px] w-48 shrink-0 rounded-xl sm:w-auto" />)}
          </div>
        )}
        {state.status === "error" && (
          <Card className="p-6 text-sm text-secondary">追蹤清單載入失敗：{state.message}</Card>
        )}
        {state.status === "ok" && items.length === 0 && <EmptyState onAdd={add} />}

        {items.length > 0 && (
          <nav
            aria-label="追蹤清單"
            className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5"
          >
            {items.map((item) => (
              <WatchCard
                key={item.code}
                code={item.code}
                name={item.name}
                quote={quotes[item.code]}
                selected={item.code === selected}
                onSelect={() => setPicked(item.code)}
                onRemove={() => handleRemove(item.code)}
                ai={ai.get(item.code)}
                onAnalyze={() => handleAnalyze(item.code)}
              />
            ))}
          </nav>
        )}

        {selected && (
          <StockDetail
            key={selected}
            code={selected}
            quote={quotes[selected]}
            onOpenSettings={() => setSettingsOpen(true)}
            ai={ai.get(selected)}
            aiHasKey={ai.hasKey}
            aiModel={ai.model}
            onAnalyze={() => ai.run(selected)}
          />
        )}
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pt-4 pb-10 text-[11px] leading-relaxed text-muted sm:px-6">
        資料來源：證交所基本市況報導（即時）、FinMind（歷史與籌碼）、Yahoo 股市（新聞）。
        報價可能有延遲，僅供參考，不構成投資建議。
      </footer>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
      <path
        d="M8.6 2.5h2.8l.4 2.1 1.5.9 2-.8 1.4 2.4-1.6 1.4v1.8l1.6 1.4-1.4 2.4-2-.8-1.5.9-.4 2.1H8.6l-.4-2.1-1.5-.9-2 .8-1.4-2.4 1.6-1.4V9.1L3.3 7.7l1.4-2.4 2 .8 1.5-.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth={1.4} />
    </svg>
  );
}

function MarketBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-up-soft px-2.5 py-1 text-[11px] font-medium text-up">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-70" />
        <span className="relative inline-flex size-1.5 rounded-full bg-up" />
      </span>
      盤中即時
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-secondary ring-1 ring-border">
      <span className="size-1.5 rounded-full bg-muted" />
      已收盤
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: (code: string) => Promise<string | null> }) {
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <Card className="relative overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_50%_0%,var(--accent-soft),transparent)]" />
      <div className="relative">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <svg viewBox="0 0 20 20" className="size-6" aria-hidden>
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">開始建立你的追蹤清單</h2>
        <p className="mt-1.5 text-sm text-secondary">在右上角輸入股票代號，或從熱門股快速加入</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.code}
              disabled={adding !== null}
              onClick={async () => {
                setAdding(s.code);
                await onAdd(s.code);
                setAdding(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm shadow-card ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-pop disabled:opacity-50"
            >
              <span className="text-accent">+</span>
              {s.name}
              <span className="font-mono text-xs text-muted">{s.code}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function StockDetail({
  code,
  quote,
  onOpenSettings,
  ai,
  aiHasKey,
  aiModel,
  onAnalyze,
}: {
  code: string;
  quote?: RealtimeQuote;
  onOpenSettings: () => void;
  ai: AiState;
  aiHasKey: boolean;
  aiModel: string;
  onAnalyze: () => void;
}) {
  const chips = useChips(code);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {quote ? <QuoteSummary quote={quote} /> : <Skeleton className="h-[290px] rounded-2xl" />}
          <HistorySection code={code} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {quote ? <OrderBook quote={quote} /> : <Skeleton className="h-[330px] rounded-2xl" />}
          <ChipTiles chips={chips} />
          <AiAnalysisPanel
            state={ai}
            hasKey={aiHasKey}
            model={aiModel}
            onRun={onAnalyze}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </div>

      <InstitutionalPanel chips={chips} />

      <NewsPanel code={code} name={quote?.name} />
    </>
  );
}

function HistorySection({ code }: { code: string }) {
  const [history, setHistory] = useState<Load<PricePoint[]>>({ status: "loading" });
  const [rangeDays, setRangeDays] = useState<number>(90);

  useEffect(() => {
    // 一次抓一年，切換區間時在前端篩選
    getJson<{ prices: PricePoint[] }>(`/api/finmind/history?code=${code}&days=365`)
      .then((body) => setHistory({ status: "ok", data: body.prices }))
      .catch((e: Error) => setHistory({ status: "error", message: e.message }));
  }, [code]);

  const visible = useMemo(() => {
    if (history.status !== "ok") return [];
    const from = new Date();
    from.setDate(from.getDate() - rangeDays);
    const fromIso = from.toISOString().slice(0, 10);
    return history.data.filter((p) => p.date >= fromIso);
  }, [history, rangeDays]);

  const periodReturn =
    visible.length > 1 ? ((visible.at(-1)!.close - visible[0].close) / visible[0].close) * 100 : null;

  return (
    <Card>
      <CardHeader
        title="股價走勢"
        subtitle={
          periodReturn !== null ? (
            <>
              區間報酬{" "}
              <span className={`font-medium tabular-nums ${toneClass(periodReturn)}`}>
                {periodReturn >= 0 ? "+" : ""}
                {periodReturn.toFixed(2)}%
              </span>
              <span className="ml-1">· 日收盤價 · FinMind</span>
            </>
          ) : (
            "日收盤價 · FinMind"
          )
        }
        action={<Segmented label="時間區間" options={RANGES} value={rangeDays} onChange={setRangeDays} />}
      />
      <div className="px-3 pb-4 sm:px-4">
        {history.status === "loading" && <Skeleton className="mx-2 h-[300px]" />}
        {history.status === "error" && <EmptyNote text={`載入失敗：${history.message}`} className="h-[300px]" />}
        {history.status === "ok" &&
          (visible.length > 1 ? (
            <PriceChart data={visible} />
          ) : (
            <EmptyNote text="這段期間沒有資料" className="h-[300px]" />
          ))}
      </div>
    </Card>
  );
}
