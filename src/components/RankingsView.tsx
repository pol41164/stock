"use client";

import { useEffect, useState } from "react";
import type { BuyRankings, RankItem } from "@/lib/insti-rank";
import type { WatchlistEntry } from "@/app/api/watchlist/route";
import type { SnapshotSummary } from "@/app/api/rankings/snapshots/route";
import { getJson, type Load } from "@/lib/client";
import SiteHeader from "./SiteHeader";
import { Card, CardHeader, EmptyNote, Segmented, Skeleton } from "./ui";

const TOP_OPTIONS = [
  { value: 10, label: "前 10" },
  { value: 20, label: "前 20" },
  { value: 50, label: "前 50" },
] as const;

export default function RankingsView() {
  const [data, setData] = useState<Load<BuyRankings>>({ status: "loading" });
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [top, setTop] = useState<number>(50);
  // "live" = 目前最新排行；其他值 = 已儲存的交易日
  const [view, setView] = useState<string>("live");
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [save, setSave] = useState<{ status: "idle" | "saving" | "saved" | "error"; message?: string }>({
    status: "idle",
  });

  useEffect(() => {
    // 標示追蹤清單中的公司（失敗就不標示）
    getJson<{ items: WatchlistEntry[] }>("/api/watchlist")
      .then(({ items }) => setWatched(new Set(items.map((i) => i.name))))
      .catch(() => {});

    // 已儲存的排行（失敗就只顯示最新排行）
    getJson<{ items: SnapshotSummary[] }>("/api/rankings/snapshots")
      .then(({ items }) => setSnapshots(items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getJson<BuyRankings>(view === "live" ? "/api/rankings" : `/api/rankings/snapshots/${view}`)
      .then((d) => !cancelled && setData({ status: "ok", data: d }))
      .catch((e: Error) => !cancelled && setData({ status: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [view]);

  async function saveSnapshot() {
    setSave({ status: "saving" });
    try {
      const res = await fetch("/api/rankings/snapshots", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const item = body.item as SnapshotSummary;
      setSnapshots((prev) => [item, ...prev.filter((s) => s.date !== item.date)].sort((a, b) => b.date.localeCompare(a.date)));
      setSave({ status: "saved", message: `已儲存 ${item.date} 的排行` });
    } catch (e) {
      setSave({ status: "error", message: `儲存失敗：${(e as Error).message}` });
    }
  }

  const liveDate = view === "live" && data.status === "ok" ? data.data.date : null;
  const alreadySaved = liveDate !== null && snapshots.some((s) => s.date === liveDate);

  const foreign = data.status === "ok" ? data.data.foreign.slice(0, top) : [];
  const trust = data.status === "ok" ? data.data.trust.slice(0, top) : [];

  // 外資、投信同時買超的公司
  const trustNames = new Set(trust.map((i) => i.name));
  const both = new Set(foreign.filter((i) => trustNames.has(i.name)).map((i) => i.name));

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">法人買超金額排行</h1>
            <p className="mt-1 text-sm text-secondary">
              {data.status === "ok" && data.data.date
                ? `${data.data.date} 交易日 · ${data.data.markets.join("＋")} · 依買超金額由高到低`
                : "每日盤後更新 · 依買超金額由高到低"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="rank-view" className="sr-only">選擇排行日期</label>
            <select
              id="rank-view"
              value={view}
              onChange={(e) => {
                setView(e.target.value);
                setData({ status: "loading" });
                setSave({ status: "idle" });
              }}
              className="rounded-lg bg-surface px-2.5 py-1.5 text-xs ring-1 ring-border outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="live">最新排行</option>
              {snapshots.map((s) => (
                <option key={s.date} value={s.date}>
                  {s.date}（已儲存）
                </option>
              ))}
            </select>
            {view === "live" && (
              <button
                type="button"
                onClick={saveSnapshot}
                disabled={data.status !== "ok" || save.status === "saving"}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                {save.status === "saving" ? "儲存中…" : alreadySaved ? "重新儲存" : "儲存排行"}
              </button>
            )}
            <Segmented label="顯示筆數" options={TOP_OPTIONS} value={top} onChange={setTop} />
          </div>
        </div>

        {save.message && (
          <p role="status" className={`-mt-3 text-xs ${save.status === "error" ? "text-up" : "text-secondary"}`}>
            {save.message}
          </p>
        )}

        {data.status === "error" && (
          <Card className="p-6 text-sm text-secondary">排行載入失敗：{data.message}</Card>
        )}

        {data.status !== "error" && (
          <>
            <BothCard names={[...both]} loading={data.status === "loading"} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <RankCard
                title="外資買超金額排行"
                items={foreign}
                loading={data.status === "loading"}
                both={both}
                watched={watched}
                rows={top}
              />
              <RankCard
                title="投信買超金額排行"
                items={trust}
                loading={data.status === "loading"}
                both={both}
                watched={watched}
                rows={top}
              />
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pt-4 pb-10 text-[11px] leading-relaxed text-muted sm:px-6">
        資料來源：證交所三大法人買賣超日報（T86）、櫃買中心三大法人日報與每日收盤價。買超金額 = 買賣超股數 × 收盤價（估算），每日盤後更新，僅供參考，不構成投資建議。
      </footer>
    </>
  );
}

function BothCard({ names, loading }: { names: string[]; loading: boolean }) {
  return (
    <Card className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">雙買</span>
          外資、投信同步買超
        </h2>
        {loading ? (
          <Skeleton className="h-6 w-64" />
        ) : names.length === 0 ? (
          <span className="text-sm text-muted">目前顯示範圍內沒有重疊的公司</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {names.map((n) => (
              <span key={n} className="rounded-full bg-surface-2 px-2.5 py-1 text-sm ring-1 ring-border">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function RankCard({
  title,
  items,
  loading,
  both,
  watched,
  rows,
}: {
  title: string;
  items: RankItem[];
  loading: boolean;
  both: Set<string>;
  watched: Set<string>;
  rows: number;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={loading ? "載入中…" : `共 ${items.length} 家`} />
      <div className="px-2 pb-3 sm:px-3">
        {loading && (
          <div className="flex flex-col gap-1.5 px-3 pb-2">
            {Array.from({ length: Math.min(rows, 10) }, (_, i) => <Skeleton key={i} className="h-9" />)}
          </div>
        )}
        {!loading && items.length === 0 && <EmptyNote text="沒有資料" className="h-40" />}
        {!loading && items.length > 0 && (
          <ol>
            {items.map((item) => (
              <li
                key={item.rank}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-2"
              >
                <RankNumber rank={item.rank} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                {both.has(item.name) && (
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">雙買</span>
                )}
                {watched.has(item.name) && (
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-secondary ring-1 ring-border">追蹤中</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function RankNumber({ rank }: { rank: number }) {
  const top3 = rank <= 3;
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
        top3 ? "bg-foreground text-background" : "bg-surface-2 text-secondary ring-1 ring-border"
      }`}
    >
      {rank}
    </span>
  );
}
