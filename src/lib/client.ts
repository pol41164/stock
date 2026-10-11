// 前端共用：呼叫我們自己的後端 API 與數字格式化

export type Load<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: T };

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const fmtPrice = (n: number) =>
  n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (n: number) => n.toLocaleString("zh-TW");

export const fmtSigned = (n: number) => `${n > 0 ? "+" : ""}${fmtInt(n)}`;

// 台股慣例：紅漲綠跌
export const toneClass = (n: number) =>
  n > 0 ? "text-up" : n < 0 ? "text-down" : "text-secondary";

export const arrow = (n: number) => (n > 0 ? "▲" : n < 0 ? "▼" : "—");

// 台北時間週一至週五 09:00–13:35 視為盤中（不含國定假日）
export function isMarketOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  if (get("weekday") === "Sat" || get("weekday") === "Sun") return false;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return minutes >= 9 * 60 && minutes <= 13 * 60 + 35;
}
