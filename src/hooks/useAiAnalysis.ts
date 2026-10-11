"use client";

import { useCallback, useState } from "react";
import type { AiAnalysis } from "@/lib/ai-models";
import { useAiSettings } from "@/lib/byok";

export type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: AiAnalysis };

const IDLE: AiState = { status: "idle" };

// 每檔股票各自保存一份 AI 分析結果，切換股票不會遺失
export function useAiAnalysis() {
  const { apiKey, model } = useAiSettings();
  const [byCode, setByCode] = useState<Record<string, AiState>>({});

  const set = (code: string, state: AiState) => setByCode((prev) => ({ ...prev, [code]: state }));

  const run = useCallback(
    async (code: string) => {
      set(code, { status: "loading" });
      try {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-OpenAI-Key": apiKey },
          body: JSON.stringify({ code, model }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        set(code, { status: "ok", data: body as AiAnalysis });
      } catch (e) {
        set(code, { status: "error", message: (e as Error).message });
      }
    },
    [apiKey, model],
  );

  const get = (code: string): AiState => byCode[code] ?? IDLE;

  return { get, run, hasKey: !!apiKey, model };
}
