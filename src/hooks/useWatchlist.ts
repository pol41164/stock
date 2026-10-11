"use client";

import { useCallback, useEffect, useState } from "react";
import type { WatchlistEntry } from "@/app/api/watchlist/route";
import { getJson } from "@/lib/client";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; items: WatchlistEntry[] };

export function useWatchlist() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    getJson<{ items: WatchlistEntry[] }>("/api/watchlist")
      .then(({ items }) => setState({ status: "ok", items }))
      .catch((e: Error) => setState({ status: "error", message: e.message }));
  }, []);

  // 成功回傳 null，失敗回傳錯誤訊息
  const add = useCallback(async (code: string): Promise<string | null> => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body.error ?? `加入失敗（HTTP ${res.status}）`;

    setState((prev) =>
      prev.status === "ok" ? { status: "ok", items: [...prev.items, body.item] } : prev,
    );
    return null;
  }, []);

  const remove = useCallback(async (code: string): Promise<string | null> => {
    const res = await fetch(`/api/watchlist/${encodeURIComponent(code)}`, { method: "DELETE" });
    // 404 代表已經不在清單裡，一樣從畫面移除
    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      return body.error ?? `移除失敗（HTTP ${res.status}）`;
    }
    setState((prev) =>
      prev.status === "ok" ? { status: "ok", items: prev.items.filter((i) => i.code !== code) } : prev,
    );
    return null;
  }, []);

  return { state, add, remove };
}
