import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// 追蹤清單中的一檔股票
const watchItemSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    market: { type: String, enum: ["tse", "otc"], required: true },
  },
  { timestamps: true },
);

export type WatchItemDoc = InferSchemaType<typeof watchItemSchema>;

// 熱重載時避免重複註冊 model
export const WatchItem: Model<WatchItemDoc> =
  (models.WatchItem as Model<WatchItemDoc>) ?? model("WatchItem", watchItemSchema);
