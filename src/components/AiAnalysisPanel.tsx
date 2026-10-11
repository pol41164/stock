"use client";

import { AI_MODELS, type AiAnalysis, type AiPoint } from "@/lib/ai-models";
import type { AiState } from "@/hooks/useAiAnalysis";
import { Card, CardHeader, Skeleton } from "./ui";

export const VERDICT_STYLE: Record<AiAnalysis["verdict"], string> = {
  利多: "bg-up-soft text-up ring-up/30",
  利空: "bg-down-soft text-down ring-down/30",
  中性: "bg-surface-2 text-secondary ring-border",
};

export default function AiAnalysisPanel({
  state,
  hasKey,
  model,
  onRun,
  onOpenSettings,
}: {
  state: AiState;
  hasKey: boolean;
  model: string;
  onRun: () => void;
  onOpenSettings: () => void;
}) {
  const modelLabel = AI_MODELS.find((m) => m.id === model)?.label ?? model;

  const runButton = hasKey && (
    <button
      onClick={onRun}
      disabled={state.status === "loading"}
      className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      <SparkIcon />
      {state.status === "ok" || state.status === "error" ? "重新分析" : "開始分析"}
    </button>
  );

  return (
    <Card>
      <div id="ai-panel" className="scroll-mt-24" />
      <CardHeader
        title={
          <span className="inline-flex items-center gap-1.5">
            <span className="text-accent"><SparkIcon /></span>
            AI 多空判讀
          </span>
        }
        subtitle={hasKey ? `${modelLabel} · 依即時報價、技術面、籌碼與新聞` : "需要你自己的 OpenAI API Key"}
        action={runButton}
      />

      <div className="px-5 pb-5 sm:px-6">
        {!hasKey && (
          <div className="rounded-xl bg-surface-2 p-4 text-center ring-1 ring-border">
            <p className="text-sm text-secondary">在設定中輸入 OpenAI API Key 後，即可讓 AI 判讀這檔股票目前偏利多還是利空。</p>
            <button
              onClick={onOpenSettings}
              className="mt-3 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              前往設定
            </button>
          </div>
        )}

        {hasKey && state.status === "idle" && (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-secondary ring-1 ring-border">
            按「開始分析」，AI 會整理這檔股票目前的資料並判斷多空。每次分析都會使用你的 OpenAI 額度。
          </p>
        )}

        {state.status === "loading" && (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="text-xs text-muted">AI 分析中，約需 10–60 秒…</p>
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-xl bg-up-soft p-4 text-sm text-up ring-1 ring-up/20">
            {state.message}
            {/Key/.test(state.message) && (
              <button onClick={onOpenSettings} className="ml-2 underline underline-offset-2">前往設定</button>
            )}
          </div>
        )}

        {state.status === "ok" && <Result data={state.data} />}
      </div>
    </Card>
  );
}

function Result({ data }: { data: AiAnalysis }) {
  const time = (iso: string) =>
    new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className={`rounded-xl px-3.5 py-1.5 text-lg font-semibold ring-1 ${VERDICT_STYLE[data.verdict]}`}>
          {data.verdict === "利多" ? "▲ " : data.verdict === "利空" ? "▼ " : ""}
          {data.verdict}
        </span>
        <div className="text-xs text-muted">
          信心度
          <span className="ml-1.5 inline-flex gap-0.5 align-middle" aria-label={`信心度${data.confidence}`}>
            {["低", "中", "高"].map((lv, i) => (
              <span
                key={lv}
                className={`h-2 w-4 rounded-sm ${i <= ["低", "中", "高"].indexOf(data.confidence) ? "bg-foreground" : "bg-grid"}`}
              />
            ))}
          </span>
          <span className="ml-1.5 font-medium text-secondary">{data.confidence}</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed">{data.summary}</p>

      <PointList title="利多因素" tone="up" points={data.bullish} />
      <PointList title="利空因素" tone="down" points={data.bearish} />

      <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
        {data.model} · {time(data.generatedAt)} 產生
        {data.dataAsOf && ` · 報價資料 ${time(data.dataAsOf)}`}
        <br />
        AI 判讀可能出錯，僅供參考，不構成投資建議。
      </p>
    </div>
  );
}

function PointList({ title, tone, points }: { title: string; tone: "up" | "down"; points: AiPoint[] }) {
  return (
    <div>
      <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${tone === "up" ? "text-up" : "text-down"}`}>
        <span className={`size-1.5 rounded-full ${tone === "up" ? "bg-up" : "bg-down"}`} />
        {title}
        <span className="font-normal text-muted">{points.length}</span>
      </h3>
      {points.length === 0 ? (
        <p className="text-xs text-muted">無明顯{title.slice(0, 2)}因素</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {points.map((p, i) => (
            <li key={i} className={`rounded-xl border-l-2 bg-surface-2 py-2.5 pr-3 pl-3 ${tone === "up" ? "border-up" : "border-down"}`}>
              <p className="text-sm font-medium">{p.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-secondary">{p.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <path d="M8 1.5l1.6 4.4 4.4 1.6-4.4 1.6L8 13.5l-1.6-4.4L2 7.5l4.4-1.6z" fill="currentColor" />
    </svg>
  );
}
