import { cacheLife } from "next/cache";

// Yahoo 奇摩股市個股新聞 RSS，上市、上櫃都只需要代號
const YAHOO_RSS = "https://tw.stock.yahoo.com/rss";

export type NewsItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: string; // ISO
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// 取出 <tag>…</tag> 內容，支援 CDATA，並去掉 HTML 標籤
function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const raw = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return decode(raw.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

export async function getYahooNews(code: string): Promise<NewsItem[]> {
  "use cache";
  cacheLife({ revalidate: 300, expire: 3600 });

  const res = await fetch(`${YAHOO_RSS}?s=${encodeURIComponent(code)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (my-stock dashboard)" },
  });
  if (!res.ok) {
    throw new Error(`Yahoo RSS 回應 ${res.status}`);
  }

  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items
    .map((item) => {
      const date = new Date(tag(item, "pubDate"));
      return {
        title: tag(item, "title"),
        link: tag(item, "link"),
        summary: tag(item, "description"),
        publishedAt: Number.isNaN(date.getTime()) ? "" : date.toISOString(),
      };
    })
    // 只保留 http(s) 連結，避免把奇怪的網址放進頁面
    .filter((n) => n.title && /^https?:\/\//.test(n.link));
}
