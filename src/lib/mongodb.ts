import mongoose from "mongoose";
import { setTimezone } from "./dates";
import { getSettings } from "@/models/Settings";

export async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes("<db_password>")) {
    throw new Error(
      "Set MONGODB_URI in .env.local with your real MongoDB password (replace <db_password>).",
    );
  }

  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }

  const cached = global.mongooseCache;
  if (!cached.conn) {
    if (!cached.promise) {
      cached.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    }
    try {
      cached.conn = await cached.promise;
    } catch (e) {
      // Don't cache a failed connect, or the app never recovers once Mongo is back.
      cached.promise = null;
      throw new Error(
        `Could not reach MongoDB: ${e instanceof Error ? e.message : String(e)}. Check MONGODB_URI and Atlas network access.`,
      );
    }
  }
  // "Today" and due dates follow Settings → Timezone (default IST).
  setTimezone((await getSettings()).timezone);
  return cached.conn;
}
