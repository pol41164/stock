"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/yahoo-news";
import { getJson, type Load } from "@/lib/client";
import { Card, CardHeader, EmptyNote, Segmented, Skeleton } from "./ui";

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "news", label: "新聞" },
  { value: "notice", label: "公告" },
] as const;
type Filter = (typeof FILTER_OPTIONS)[number]["value"];

const isNotice = (n: NewsItem) => n.title.startsWith("【公告】");

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "剛剛";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(iso).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
}

export default function NewsPanel({ code, name }: { code: string; name?: string }) {
  const [news, setNews] = useState<Load<NewsItem[]>>({ status: "loading" });
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    getJson<{ news: NewsItem[] }>(`/api/news?code=${code}`)
      .then((body) => setNews({ status: "ok", data: body.news }))
      .catch((e: Error) => setNews({ status: "error", message: e.message }));
  }, [code]);

  const filtered =
    news.status === "ok"
      ? news.data.filter((n) => filter === "all" || (filter === "notice") === isNotice(n))
      : [];

  return (
    <Card>
      <CardHeader
        title={`${name ?? code} 相關新聞`}
        subtitle="Yahoo 股市 RSS · 約 5 分鐘更新"
        action={
          <Segmented
            label="新聞類型"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setLimit(PAGE_SIZE);
            }}
          />
        }
      />

      <div className="px-2 pb-3 sm:px-3">
        {news.status === "loading" && (
          <div className="grid gap-2 px-3 pb-2 md:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        )}
        {news.status === "error" && <EmptyNote text={`載入失敗：${news.message}`} className="h-40" />}
        {news.status === "ok" && filtered.length === 0 && <EmptyNote text="目前沒有相關新聞" className="h-40" />}

        {filtered.length > 0 && (
          <>
            <ul className="grid md:grid-cols-2 md:gap-x-2">
              {filtered.slice(0, limit).map((n) => (
                <li key={n.link}>
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        {isNotice(n) ? (
                          <span className="rounded bg-accent-soft px-1.5 py-px font-medium text-accent">公告</span>
                        ) : (
                          <span className="rounded bg-surface-2 px-1.5 py-px ring-1 ring-border">新聞</span>
                        )}
                        <time dateTime={n.publishedAt}>{timeAgo(n.publishedAt)}</time>
                      </div>
                      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug group-hover:text-accent">
                        {n.title.replace(/^【公告】/, "")}
                      </h3>
                      {n.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-secondary">{n.summary}</p>}
                    </div>
                    <svg viewBox="0 0 16 16" className="mt-1 size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                      <path d="M5 11L11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
            {filtered.length > limit && (
              <div className="px-3 pt-1">
                <button
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="w-full rounded-xl py-2.5 text-sm font-medium text-secondary ring-1 ring-border transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  顯示更多 · 還有 {filtered.length - limit} 則
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
