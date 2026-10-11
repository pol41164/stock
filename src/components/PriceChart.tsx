"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PricePoint } from "@/lib/finmind";
import { fmtInt, fmtPrice, toneClass } from "@/lib/client";

const HEIGHT = 300;
const PAD = { top: 16, right: 64, bottom: 28, left: 4 };

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
  return ticks;
}

export default function PriceChart({ data }: { data: PricePoint[] }) {
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
    const closes = data.map((d) => d.close);
    const lo = Math.min(...closes);
    const hi = Math.max(...closes);
    const pad = (hi - lo) * 0.1 || hi * 0.01;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const innerW = Math.max(width - PAD.left - PAD.right, 1);
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

    const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.close)}`).join("");
    const area = `${line}L${x(data.length - 1)},${PAD.top + innerH}L${x(0)},${PAD.top + innerH}Z`;

    // x 軸：每個月第一個交易日標一次，太擠就略過
    const monthTicks = data
      .map((d, i) => ({ i, month: d.date.slice(0, 7) }))
      .filter((t, k, arr) => k > 0 && t.month !== arr[k - 1].month);
    const xTicks = monthTicks.filter((t, k) => k === 0 || x(t.i) - x(monthTicks[k - 1].i) >= 48);

    return { x, y, line, area, yTicks: niceTicks(yMin, yMax), xTicks, innerW, innerH };
  }, [data, width]);

  function onPointer(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
  }

  const last = data[data.length - 1];
  const h = hover !== null ? data[hover] : null;
  const prev = hover ? data[hover - 1] : null;
  const tagValue = h ? h.close : last.close;
  const tagY = geo.y(tagValue);

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`收盤價走勢，${data[0].date} 至 ${last.date}`}>
          <defs>
            <linearGradient id="price-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
              <stop offset="70%" stopColor="var(--series-1)" stopOpacity={0.04} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {geo.yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + geo.innerW} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--grid)" />
              <text x={PAD.left + geo.innerW + 10} y={geo.y(t)} dy="0.32em" fontSize={11} fill="var(--text-muted)" className="tabular-nums">
                {fmtInt(t)}
              </text>
            </g>
          ))}

          {geo.xTicks.map((t) => (
            <text key={t.i} x={geo.x(t.i)} y={HEIGHT - 8} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
              {Number(t.month.slice(5))}月
            </text>
          ))}

          <path d={geo.area} fill="url(#price-area)" />
          <path d={geo.line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* 現價（或滑鼠所在日）水平虛線 + 右側價格標籤 */}
          <line
            x1={PAD.left}
            x2={PAD.left + geo.innerW}
            y1={tagY}
            y2={tagY}
            stroke="var(--series-1)"
            strokeOpacity={0.5}
            strokeDasharray="2 3"
          />
          <g transform={`translate(${PAD.left + geo.innerW + 4}, ${tagY})`}>
            <rect x={0} y={-10} width={PAD.right - 6} height={20} rx={5} fill="var(--series-1)" />
            <text x={(PAD.right - 6) / 2} dy="0.34em" fontSize={11} fontWeight={600} fill="#fff" textAnchor="middle" className="tabular-nums">
              {fmtInt(Math.round(tagValue))}
            </text>
          </g>

          {hover === null ? (
            <circle cx={geo.x(data.length - 1)} cy={geo.y(last.close)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          ) : (
            <g pointerEvents="none">
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={PAD.top + geo.innerH} stroke="var(--border-strong)" />
              <circle cx={geo.x(hover)} cy={geo.y(data[hover].close)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}

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
          className="pointer-events-none absolute top-3 min-w-36 rounded-xl border border-border bg-surface/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur"
          style={geo.x(hover) > width / 2 ? { right: width - geo.x(hover) + 14 } : { left: geo.x(hover) + 14 }}
        >
          <div className="text-muted">{h.date}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-semibold tabular-nums">{fmtPrice(h.close)}</span>
            {prev && (
              <span className={`tabular-nums ${toneClass(h.close - prev.close)}`}>
                {h.close >= prev.close ? "+" : ""}
                {(((h.close - prev.close) / prev.close) * 100).toFixed(2)}%
              </span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
            <dt className="text-muted">開</dt><dd className="text-right">{fmtPrice(h.open)}</dd>
            <dt className="text-muted">高</dt><dd className="text-right">{fmtPrice(h.high)}</dd>
            <dt className="text-muted">低</dt><dd className="text-right">{fmtPrice(h.low)}</dd>
            <dt className="text-muted">量</dt><dd className="text-right">{fmtInt(Math.round(h.volume / 1000))} 張</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
