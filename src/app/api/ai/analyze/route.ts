import { AiError, analyzeStock } from "@/lib/ai";
import { DEFAULT_AI_MODEL, isAiModel } from "@/lib/ai-models";

// POST /api/ai/analyze
// Header：X-OpenAI-Key: sk-...（BYOK，使用者自己的 key，只轉送給 OpenAI，不儲存也不寫進 log）
// Body：{ "code": "2330", "model": "gpt-6.1-sol" }
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-key")?.trim();
  if (!apiKey) {
    return Response.json({ error: "請先在設定中輸入 OpenAI API Key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const model = body?.model ?? DEFAULT_AI_MODEL;

  if (!/^\w{4,6}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }
  if (!isAiModel(model)) {
    return Response.json({ error: `不支援的模型：${model}` }, { status: 400 });
  }

  try {
    const analysis = await analyzeStock(apiKey, model, code);
    return Response.json(analysis);
  } catch (err) {
    if (err instanceof AiError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return Response.json({ error: "AI 回應逾時，請再試一次" }, { status: 504 });
    }
    // 只記錄錯誤訊息，避免把含 key 的 request 內容寫進 log
    console.error("AI analyze failed:", (err as Error).message);
    return Response.json({ error: "AI 分析失敗" }, { status: 500 });
  }
}
