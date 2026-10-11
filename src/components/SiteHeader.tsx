"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "個股儀表板" },
  { href: "/rankings", label: "法人買超排行" },
];

// 全站共用的頂部工具列：Logo、站名、分頁導覽；右側放各頁自己的操作（children）
export default function SiteHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">我的股票摘要站</p>
            <p className="hidden text-[11px] text-muted sm:block">台股監控儀表板</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">{children}</div>
      </div>

      <nav aria-label="分頁" className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative px-3 pt-1 pb-2.5 text-sm transition-colors ${
                active ? "font-semibold text-foreground" : "text-muted hover:text-secondary"
              }`}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background shadow-card">
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
        <path d="M3 14l4-4.5 3 2.5 6-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="5" r="1.6" fill="currentColor" />
      </svg>
    </div>
  );
}
