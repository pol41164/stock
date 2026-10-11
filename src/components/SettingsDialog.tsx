"use client";

import { useEffect, useRef, useState } from "react";
import { AI_MODELS, type AiModelId } from "@/lib/ai-models";
import { maskKey, saveAiSettings, useAiSettings } from "@/lib/byok";

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      {/* 每次打開都重新掛載表單，帶入最新設定 */}
      {open && <SettingsForm onClose={onClose} />}
    </dialog>
  );
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const saved = useAiSettings();
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [model, setModel] = useState<AiModelId>(saved.model);
  const [show, setShow] = useState(false);

  const looksValid = !apiKey.trim() || /^sk-[\w-]{20,}$/.test(apiKey.trim());

  function save(e: React.FormEvent) {
    e.preventDefault();
    saveAiSettings({ apiKey, model });
    onClose();
  }

  function clear() {
    saveAiSettings({ apiKey: "", model });
    setApiKey("");
  }

  return (
    <form onSubmit={save}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">設定</h2>
          <p className="mt-0.5 text-xs text-muted">AI 分析使用你自己的 OpenAI API Key（BYOK）</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="openai-key" className="text-sm font-medium">OpenAI API Key</label>
            {saved.apiKey && (
              <span className="text-[11px] text-muted">
                目前：<span className="font-mono">{maskKey(saved.apiKey)}</span>
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-xl bg-surface-2 p-1 pl-3 ring-1 ring-border focus-within:ring-2 focus-within:ring-accent/50">
            <input
              id="openai-key"
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-secondary hover:bg-surface hover:text-foreground"
            >
              {show ? "隱藏" : "顯示"}
            </button>
          </div>
          {!looksValid && <p className="mt-1.5 text-xs text-up">格式看起來不像 OpenAI API Key（應以 sk- 開頭）</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Key 只儲存在這台瀏覽器的 localStorage。分析時會經由本站後端轉送給 OpenAI，後端不會儲存或記錄。
            請勿在公用電腦上儲存。可到{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              OpenAI 後台
            </a>{" "}
            建立 Key。
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">模型</legend>
          <div className="mt-2 grid gap-2">
            {AI_MODELS.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-colors ${
                  model === m.id ? "bg-accent-soft ring-accent/50" : "ring-border hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={model === m.id}
                  onChange={() => setModel(m.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-[11px] text-muted">{m.note}</span>
                </span>
                <span className="font-mono text-[11px] text-muted">{m.id}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-6 py-4">
        <button
          type="button"
          onClick={clear}
          disabled={!saved.apiKey && !apiKey}
          className="text-xs text-secondary hover:text-up disabled:opacity-40"
        >
          清除 Key
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-secondary ring-1 ring-border hover:bg-surface">
            取消
          </button>
          <button type="submit" disabled={!looksValid} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40">
            儲存
          </button>
        </div>
      </div>
    </form>
  );
}
