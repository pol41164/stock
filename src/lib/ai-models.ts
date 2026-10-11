// 前後端共用：可選的 OpenAI 模型（依官方模型頁 2026-10）
export const AI_MODELS = [
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", note: "效能與成本平衡（預設）" },
  { id: "gpt-6-astra", label: "GPT-6 Astra", note: "最強推理，費用較高" },
  { id: "gpt-6-luna", label: "GPT-6 Luna", note: "最快最便宜" },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_AI_MODEL: AiModelId = "gpt-6.1-sol";

export const isAiModel = (v: unknown): v is AiModelId =>
  AI_MODELS.some((m) => m.id === v);

export type AiPoint = { title: string; detail: string };

export type AiAnalysis = {
  verdict: "利多" | "利空" | "中性";
  confidence: "低" | "中" | "高";
  summary: string;
  bullish: AiPoint[];
  bearish: AiPoint[];
  model: string;
  generatedAt: string; // ISO
  dataAsOf: string | null; // 報價資料時間
};
