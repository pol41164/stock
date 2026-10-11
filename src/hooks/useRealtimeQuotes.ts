"use client";

import { useEffect, useState } from "react";
import type { RealtimeQuote } from "@/lib/twse-mis";
import { getJson, isMarketOpen } from "@/lib/client";

const POLL_MS = 5000;

type State = {
  quotes: Record<string, RealtimeQuote>;
  error: string | null;
  live: boolean;
  updatedAt: Date | null;
};

// 整個儀表板共用一次批次請求，盤中且分頁可見時每 5 秒更新
export function useRealtimeQuotes(codes: string[]): State {
  const key = codes.join(",");
  const [state, setState] = useState<State>({ quotes: {}, error: null, live: false, updatedAt: null });

  useEffect(() => {
    if (!key) return; // 追蹤清單是空的就不用查
    let cancelled = false;

    const load = () => {
      getJson<{ quotes: RealtimeQuote[] }>(`/api/twse/realtime?codes=${key}`)
        .then(({ quotes }) => {
          if (cancelled) return;
          setState({
            quotes: Object.fromEntries(quotes.map((q) => [q.code, q])),
            error: null,
            live: isMarketOpen(),
            updatedAt: new Date(),
          });
        })
        .catch((e: Error) => {
          // 已經有資料時，單次輪詢失敗就保留舊資料
          if (!cancelled) setState((prev) => ({ ...prev, error: e.message }));
        });
    };

    load();
    const timer = setInterval(() => {
      if (isMarketOpen() && document.visibilityState === "visible") load();
      else setState((prev) => (prev.live ? { ...prev, live: false } : prev));
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key]);

  return state;
}
