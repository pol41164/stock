"use client";

import { useState } from "react";

export default function AddStockForm({ onAdd }: { onAdd: (code: string) => Promise<string | null> }) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;

    setPending(true);
    setError(null);
    const err = await onAdd(value);
    setPending(false);
    if (err) setError(err);
    else setCode("");
  }

  return (
    <form onSubmit={submit} className="relative">
      <div
        className={`flex items-center gap-1 rounded-xl bg-surface p-1 pl-3 ring-1 transition-shadow focus-within:ring-2 ${
          error ? "ring-up/60 focus-within:ring-up/60" : "ring-border focus-within:ring-accent/50"
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-muted" aria-hidden>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
        <label htmlFor="add-code" className="sr-only">股票代號</label>
        <input
          id="add-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="輸入代號"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          aria-invalid={!!error}
          aria-describedby="add-code-error"
          className="w-28 bg-transparent px-1 py-1 text-sm tabular-nums outline-none placeholder:text-muted sm:w-44"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {pending ? "加入中…" : "加入"}
        </button>
      </div>
      <p
        id="add-code-error"
        role="status"
        className={`absolute top-full right-0 z-10 mt-2 rounded-lg bg-surface px-3 py-1.5 text-xs whitespace-nowrap text-up shadow-pop ring-1 ring-border ${
          error ? "" : "hidden"
        }`}
      >
        {error}
      </p>
    </form>
  );
}
