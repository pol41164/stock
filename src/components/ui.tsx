"use client";

import { useState } from "react";

// 共用的介面元件：卡片、分段切換、骨架、數字閃爍

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-surface-2 p-0.5 ring-1 ring-border">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              active
                ? "bg-surface text-foreground shadow-card ring-1 ring-border"
                : "text-muted hover:text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-grid ${className}`} />;
}

export function EmptyNote({ text, className = "h-60" }: { text: string; className?: string }) {
  return <div className={`flex items-center justify-center text-sm text-muted ${className}`}>{text}</div>;
}

// 數值變動時短暫閃一下紅/綠底色
export function FlashValue({
  value,
  children,
  className = "",
}: {
  value: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [tick, setTick] = useState(0);

  // React 建議的「記住上一次 render 的值」寫法
  if (value !== prev) {
    setDir(value > prev ? "up" : "down");
    setPrev(value);
    setTick((t) => t + 1);
  }

  return (
    <span
      key={tick}
      className={`-mx-1 rounded-md px-1 ${dir === "up" ? "flash-up" : dir === "down" ? "flash-down" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

export function ChangePill({ change, percent, size = "md" }: { change: number; percent: number; size?: "sm" | "md" }) {
  const up = change > 0;
  const down = change < 0;
  const tone = up ? "bg-up-soft text-up" : down ? "bg-down-soft text-down" : "bg-surface-2 text-secondary";
  const arrow = up ? "▲" : down ? "▼" : "—";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium tabular-nums ${tone} ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-sm"
      }`}
    >
      <span className="text-[0.7em]">{arrow}</span>
      {size === "md" && <span>{Math.abs(change).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
      <span>{size === "md" ? `(${Math.abs(percent).toFixed(2)}%)` : `${Math.abs(percent).toFixed(2)}%`}</span>
    </span>
  );
}
