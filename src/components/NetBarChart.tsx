"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InstitutionalNet } from "@/lib/finmind";
import { arrow, fmtSigned, toneClass } from "@/lib/client";

const HEIGHT = 320;
const PAD = { top: 12, right: 64, bottom: 28, left: 8 };

export type NetKey = "total" | "foreign" | "trust" | "dealer";

export const NET_LABELS: Record<NetKey, string> = {
  total: "三大法人合計",
  foreign: "外資",
  trust: "投信",
  dealer: "自營商",
};

function niceStep(span: number, count: number) {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

// 買賣超長條圖：以 0 為基準，買超紅色往上、賣超綠色往下
export default function NetBarChart({ data, field }: { data: InstitutionalNet[]; field: NetKey }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const values = data.map((d) => d[field]);
    const maxAbs = Math.max(...values.map(Math.abs), 1);
    const step = niceStep(maxAbs * 2, 4);
    const yMax = Math.ceil(Math.max(...values, 0) / step) * step || step;
    const yMin = Math.floor(Math.min(...values, 0) / step) * step || -step;

    const innerW = Math.max(width - PAD.left - PAD.right, 1);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const slot = innerW / data.length;
    const barW = Math.max(Math.min(slot - 2, 24), 1); // 長條之間留 2px 間隔

    const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * innerH;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);

    const monthTicks = data
      .map((d, i) => ({ i, month: d.date.slice(0, 7) }))
      .filter((t, k, arr) => k > 0 && t.month !== arr[k - 1].month);

    return { y, ticks, slot, barW, innerW, innerH, monthTicks };
  }, [data, field, width]);

  const cx = (i: number) => PAD.left + geo.slot * (i + 0.5);

  function onPointer(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * data.length);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${NET_LABELS[field]}每日買賣超（張）`}>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + geo.innerW}
                y1={geo.y(t)}
                y2={geo.y(t)}
                stroke={t === 0 ? "var(--text-muted)" : "var(--grid)"}
              />
              <text x={PAD.left + geo.innerW + 8} y={geo.y(t)} dy="0.32em" fontSize={11} fill="var(--text-muted)">
                {fmtSigned(t)}
              </text>
            </g>
          ))}

          {geo.monthTicks.map((t) => (
            <text key={t.i} x={cx(t.i)} y={HEIGHT - 8} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
              {Number(t.month.slice(5))}月
            </text>
          ))}

          {data.map((d, i) => {
            const v = d[field];
            if (v === 0) return null;
            const y0 = geo.y(0);
            const y1 = geo.y(v);
            const top = Math.min(y0, y1);
            const hgt = Math.max(Math.abs(y1 - y0), 1);
            const r = Math.min(4, geo.barW / 2, hgt);
            const x = cx(i) - geo.barW / 2;
            // 只有遠離基準線的那一端是圓角
            const path =
              v > 0
                ? `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + geo.barW - r}Q${x + geo.barW},${top} ${x + geo.barW},${top + r}V${y0}Z`
                : `M${x},${y0}V${top + hgt - r}Q${x},${top + hgt} ${x + r},${top + hgt}H${x + geo.barW - r}Q${x + geo.barW},${top + hgt} ${x + geo.barW},${top + hgt - r}V${y0}Z`;
            return (
              <path
                key={d.date}
                d={path}
                fill={v > 0 ? "var(--price-up)" : "var(--price-down)"}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })}

          <rect
            x={PAD.left}
            y={0}
            width={geo.innerW}
            height={HEIGHT}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
            style={{ touchAction: "pan-y", cursor: "crosshair" }}
          />
        </svg>
      )}

      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-3 min-w-44 rounded-xl border border-border bg-surface/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur"
          style={cx(hover) > width / 2 ? { right: width - cx(hover) + 12 } : { left: cx(hover) + 12 }}
        >
          <div className="mb-1 text-muted">{h.date}（張）</div>
          {(Object.keys(NET_LABELS) as NetKey[]).map((k) => (
            <div key={k} className={`flex justify-between gap-4 ${k === field ? "font-semibold" : ""}`}>
              <span className="text-secondary">{NET_LABELS[k]}</span>
              <span className={`tabular-nums ${toneClass(h[k])}`}>
                {arrow(h[k])} {fmtSigned(h[k])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
