import mongoose from "mongoose";

// 開發模式下熱重載會重新執行模組，把連線存在 globalThis 避免重複建立連線
const globalForMongoose = globalThis as unknown as {
  mongooseConn?: Promise<typeof mongoose>;
};

export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("缺少環境變數 MONGODB_URI");
  }

  if (!globalForMongoose.mongooseConn) {
    globalForMongoose.mongooseConn = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000 })
      .catch((err) => {
        // 連線失敗時清掉，下次請求才會重試
        globalForMongoose.mongooseConn = undefined;
        throw err;
      });
  }
  return globalForMongoose.mongooseConn;
}
