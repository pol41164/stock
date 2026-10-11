"use client";

import { useEffect, useState } from "react";
import type { ChipData } from "@/lib/finmind";
import { fmtInt, fmtSigned, getJson, toneClass, type Load } from "@/lib/client";
import NetBarChart, { NET_LABELS, type NetKey } from "./NetBarChart";
import { Card, CardHeader, EmptyNote, Segmented, Skeleton } from "./ui";

const CHART_DAYS = 30; // 圖表顯示最近 30 個交易日
const TABLE_DAYS = 10;

export function useChips(code: string): Load<ChipData> {
  // 記住結果屬於哪一檔，切換股票時舊結果自動視為載入中
  const [result, setResult] = useState<{ code: string; load: Load<ChipData> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<ChipData>(`/api/finmind/chips?code=${code}&days=90`)
      .then((data) => !cancelled && setResult({ code, load: { status: "ok", data } }))
      .catch((e: Error) => !cancelled && setResult({ code, load: { status: "error", message: e.message } }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return result?.code === code ? result.load : { status: "loading" };
}

/* ---------- 籌碼摘要（數字卡片） ---------- */

export function ChipTiles({ chips }: { chips: Load<ChipData> }) {
  return (
    <Card>
      <CardHeader title="籌碼摘要" subtitle="FinMind · 每日盤後更新" />
      <div className="px-5 pb-5 sm:px-6">
        {chips.status === "loading" && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[86px]" />)}
          </div>
        )}
        {chips.status === "error" && <EmptyNote text={`載入失敗：${chips.message}`} className="h-40" />}
        {chips.status === "ok" && <TilesBody data={chips.data} />}
      </div>
    </Card>
  );
}

function TilesBody({ data }: { data: ChipData }) {
  const lastMargin = data.margin.at(-1);
  const prevMargin = data.margin.at(-2);
  const lastHold = data.foreignHolding.at(-1);
  const firstHold = data.foreignHolding.at(-Math.min(CHART_DAYS, data.foreignHolding.length));
  const sum = (k: NetKey, n: number) => data.institutional.slice(-n).reduce((acc, d) => acc + d[k], 0);
  const holdDelta = lastHold && firstHold ? lastHold.ratio - firstHold.ratio : 0;

  return (
    <dl className="grid grid-cols-2 gap-3">
      <Tile label="外資 · 近 5 日" value={fmtSigned(sum("foreign", 5))} unit="張" tone={toneClass(sum("foreign", 5))} />
      <Tile label="投信 · 近 5 日" value={fmtSigned(sum("trust", 5))} unit="張" tone={toneClass(sum("trust", 5))} />
      {lastMargin && (
        <Tile
          label="融資餘額"
          value={fmtInt(lastMargin.marginBalance)}
          unit="張"
          foot={
            prevMargin && (
              <span className={toneClass(lastMargin.marginBalance - prevMargin.marginBalance)}>
                {fmtSigned(lastMargin.marginBalance - prevMargin.marginBalance)}
                <span className="ml-1 text-muted">較前日 · 券 {fmtInt(lastMargin.shortBalance)}</span>
              </span>
            )
          }
        />
      )}
      {lastHold && (
        <Tile
          label="外資持股"
          value={lastHold.ratio.toFixed(2)}
          unit="%"
          foot={
            firstHold && (
              <span className={toneClass(holdDelta)}>
                {holdDelta >= 0 ? "+" : ""}
                {holdDelta.toFixed(2)} pt<span className="ml-1 text-muted">{CHART_DAYS} 日</span>
              </span>
            )
          }
        />
      )}
    </dl>
  );
}

function Tile({
  label,
  value,
  unit,
  tone = "",
  foot,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: string;
  foot?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3.5 ring-1 ring-border">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${tone}`}>
        {value}
        <span className="ml-1 text-[11px] font-normal text-muted">{unit}</span>
      </dd>
      {foot && <dd className="mt-1 truncate text-[11px] tabular-nums">{foot}</dd>}
    </div>
  );
}

/* ---------- 法人買賣超（圖表 + 明細） ---------- */

const FIELD_OPTIONS = (Object.keys(NET_LABELS) as NetKey[]).map((k) => ({
  value: k,
  label: k === "total" ? "合計" : NET_LABELS[k],
}));

export function InstitutionalPanel({ chips }: { chips: Load<ChipData> }) {
  const [field, setField] = useState<NetKey>("total");

  return (
    <Card>
      <CardHeader
        title="法人買賣超"
        subtitle={`最近 ${CHART_DAYS} 個交易日 · 單位：張 · FinMind`}
        action={<Segmented label="法人" options={FIELD_OPTIONS} value={field} onChange={setField} />}
      />
      <div className="px-5 pb-5 sm:px-6">
        {chips.status === "loading" && <Skeleton className="h-60" />}
        {chips.status === "error" && <EmptyNote text={`載入失敗：${chips.message}`} />}
        {chips.status === "ok" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {chips.data.institutional.length ? (
              <NetBarChart data={chips.data.institutional.slice(-CHART_DAYS)} field={field} />
            ) : (
              <EmptyNote text="沒有資料" />
            )}
            <InstitutionalTable data={chips.data} field={field} />
          </div>
        )}
      </div>
    </Card>
  );
}

function InstitutionalTable({ data, field }: { data: ChipData; field: NetKey }) {
  const recent = data.institutional.slice(-TABLE_DAYS).reverse();
  const cols = ["foreign", "trust", "dealer", "total"] as const;

  return (
    <div className="scroll-thin overflow-x-auto rounded-xl ring-1 ring-border">
      <table className="w-full min-w-[380px] text-[13px]">
        <thead className="bg-surface-2">
          <tr className="text-[11px] text-muted">
            <th className="px-3 py-2 text-left font-medium">日期</th>
            {cols.map((k) => (
              <th key={k} className={`px-3 py-2 text-right font-medium ${k === field ? "text-foreground" : ""}`}>
                {k === "total" ? "合計" : NET_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {recent.map((d) => (
            <tr key={d.date} className="border-t border-border transition-colors hover:bg-surface-2">
              <td className="px-3 py-2 text-secondary">{d.date.slice(5).replace("-", "/")}</td>
              {cols.map((k) => (
                <td
                  key={k}
                  className={`px-3 py-2 text-right ${toneClass(d[k])} ${k === field ? "bg-accent-soft font-semibold" : ""}`}
                >
                  {fmtSigned(d[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
