"use client";

import type { RealtimeQuote } from "@/lib/twse-mis";
import { fmtInt, fmtPrice, toneClass } from "@/lib/client";
import { Card, CardHeader, ChangePill, EmptyNote, FlashValue } from "./ui";

export function QuoteSummary({ quote: q }: { quote: RealtimeQuote }) {
  const time = new Date(q.time).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{q.name}</h2>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-secondary ring-1 ring-border">
            {q.code}
          </span>
          <span className="text-xs text-muted">{q.market === "tse" ? "上市" : "上櫃"}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
          <FlashValue value={q.price} className={`text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl ${toneClass(q.change)}`}>
            {fmtPrice(q.price)}
          </FlashValue>
          <div className="mb-1.5">
            <ChangePill change={q.change} percent={q.changePercent} />
          </div>
        </div>

        <DayRange low={q.low} high={q.high} price={q.price} prevClose={q.prevClose} />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-px border-t border-border bg-border sm:grid-cols-6">
        <Stat label="開盤" value={fmtPrice(q.open)} tone={toneClass(q.open - q.prevClose)} />
        <Stat label="最高" value={fmtPrice(q.high)} tone={toneClass(q.high - q.prevClose)} />
        <Stat label="最低" value={fmtPrice(q.low)} tone={toneClass(q.low - q.prevClose)} />
        <Stat label="昨收" value={fmtPrice(q.prevClose)} />
        <Stat label="成交量" value={fmtInt(q.volume)} unit="張" />
        <Stat label="漲停／跌停" value={`${fmtInt(q.limitUp)}／${fmtInt(q.limitDown)}`} />
      </dl>

      <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted sm:px-6">
        {time} 更新 · 證交所基本市況報導
      </p>
    </Card>
  );
}

// 當日價格區間條：最低 ～ 最高，標出現價與昨收位置
function DayRange({ low, high, price, prevClose }: { low: number; high: number; price: number; prevClose: number }) {
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - low) / (high - low)) * 100))}%`;

  return (
    <div className="mt-5 max-w-md">
      <div className="mb-1.5 flex justify-between text-[11px] text-muted">
        <span>當日區間</span>
        <span className="tabular-nums">
          {fmtPrice(low)} – {fmtPrice(high)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-grid">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${price >= prevClose ? "bg-up/70" : "bg-down/70"}`}
          style={{ width: pos(price) }}
        />
        {prevClose >= low && prevClose <= high && (
          <div className="absolute -top-1 h-3.5 w-px bg-secondary" style={{ left: pos(prevClose) }} title="昨收" />
        )}
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-foreground shadow"
          style={{ left: pos(price) }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, unit, tone = "" }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="bg-surface-2 px-4 py-3 sm:px-5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium tabular-nums ${tone}`}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

export function OrderBook({ quote: q }: { quote: RealtimeQuote }) {
  const rows = Math.max(q.asks.length, q.bids.length);
  const maxVol = Math.max(...q.asks.map((a) => a.volume), ...q.bids.map((b) => b.volume), 1);
  const bidTotal = q.bids.reduce((s, b) => s + b.volume, 0);
  const askTotal = q.asks.reduce((s, a) => s + a.volume, 0);
  const bidRatio = bidTotal + askTotal ? (bidTotal / (bidTotal + askTotal)) * 100 : 50;

  return (
    <Card>
      <CardHeader title="最佳五檔" subtitle="委買 / 委賣（張）" />
      {rows === 0 ? (
        <EmptyNote text="目前沒有委託資料" className="h-40" />
      ) : (
        <div className="px-5 pb-5 sm:px-6">
          <div className="grid grid-cols-2 gap-x-3 text-[11px] text-muted">
            <div className="flex justify-between px-2 pb-1.5"><span>委買量</span><span>買價</span></div>
            <div className="flex justify-between px-2 pb-1.5"><span>賣價</span><span>委賣量</span></div>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            {Array.from({ length: rows }, (_, i) => {
              const bid = q.bids[i];
              const ask = q.asks[i];
              return (
                <div key={i} className="contents">
                  <div className="relative flex h-8 items-center justify-between overflow-hidden rounded-md px-2 text-sm tabular-nums">
                    {bid && (
                      <>
                        <div className="absolute inset-y-0.5 right-0 rounded-md bg-up-soft" style={{ width: `${(bid.volume / maxVol) * 100}%` }} />
                        <span className="relative text-secondary">{fmtInt(bid.volume)}</span>
                        <span className={`relative font-medium ${toneClass(bid.price - q.prevClose)}`}>{fmtPrice(bid.price)}</span>
                      </>
                    )}
                  </div>
                  <div className="relative flex h-8 items-center justify-between overflow-hidden rounded-md px-2 text-sm tabular-nums">
                    {ask && (
                      <>
                        <div className="absolute inset-y-0.5 left-0 rounded-md bg-down-soft" style={{ width: `${(ask.volume / maxVol) * 100}%` }} />
                        <span className={`relative font-medium ${toneClass(ask.price - q.prevClose)}`}>{fmtPrice(ask.price)}</span>
                        <span className="relative text-secondary">{fmtInt(ask.volume)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="flex h-1.5 overflow-hidden rounded-full">
              <div className="bg-up/80" style={{ width: `${bidRatio}%` }} />
              <div className="ml-0.5 flex-1 bg-down/80" />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
              <span>委買 {fmtInt(bidTotal)}（{bidRatio.toFixed(0)}%）</span>
              <span>委賣 {fmtInt(askTotal)}（{(100 - bidRatio).toFixed(0)}%）</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
