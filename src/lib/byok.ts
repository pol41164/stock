"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_AI_MODEL, isAiModel, type AiModelId } from "@/lib/ai-models";

// BYOK：使用者自己的 OpenAI API Key 只存在這台瀏覽器的 localStorage
const KEY_STORAGE = "my-stock:openai-api-key";
const MODEL_STORAGE = "my-stock:openai-model";

type Settings = { apiKey: string; model: AiModelId };

const listeners = new Set<() => void>();
let cache: Settings | null = null;
const SERVER: Settings = { apiKey: "", model: DEFAULT_AI_MODEL };

function read(): Settings {
  if (cache) return cache;
  try {
    const apiKey = localStorage.getItem(KEY_STORAGE) ?? "";
    const model = localStorage.getItem(MODEL_STORAGE);
    cache = { apiKey, model: isAiModel(model) ? model : DEFAULT_AI_MODEL };
  } catch {
    // 無痕模式或封鎖儲存時，退回只存在記憶體
    cache = { ...SERVER };
  }
  return cache;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // 其他分頁修改設定時同步
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY_STORAGE || e.key === MODEL_STORAGE) {
      cache = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveAiSettings(next: Settings) {
  cache = { apiKey: next.apiKey.trim(), model: next.model };
  try {
    if (cache.apiKey) localStorage.setItem(KEY_STORAGE, cache.apiKey);
    else localStorage.removeItem(KEY_STORAGE);
    localStorage.setItem(MODEL_STORAGE, cache.model);
  } catch {
    // 寫入失敗時仍保留在記憶體，本次瀏覽可用
  }
  listeners.forEach((fn) => fn());
}

export function useAiSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

// 顯示用：sk-proj-abc…wxyz
export function maskKey(key: string) {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : "••••";
}
