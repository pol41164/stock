import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// 某個交易日的外資／投信買超金額排行快照，一個交易日一筆
const rankItemSchema = new Schema(
  {
    rank: { type: Number, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const rankingSnapshotSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    foreign: { type: [rankItemSchema], default: [] },
    trust: { type: [rankItemSchema], default: [] },
    markets: { type: [String], enum: ["上市", "上櫃"], default: [] },
  },
  { timestamps: true },
);

export type RankingSnapshotDoc = InferSchemaType<typeof rankingSnapshotSchema>;

// 熱重載時避免重複註冊 model
export const RankingSnapshot: Model<RankingSnapshotDoc> =
  (models.RankingSnapshot as Model<RankingSnapshotDoc>) ?? model("RankingSnapshot", rankingSnapshotSchema);
