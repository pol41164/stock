import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { WatchItem } from "@/models/WatchItem";

// DELETE /api/watchlist/2330：從追蹤清單移除
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/watchlist/[code]">) {
  const { code } = await ctx.params;

  try {
    await connectDB();
    const result = await WatchItem.deleteOne({ code });
    if (result.deletedCount === 0) {
      return Response.json({ error: `${code} 不在追蹤清單中` }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "無法移除追蹤項目" }, { status: 500 });
  }
}
