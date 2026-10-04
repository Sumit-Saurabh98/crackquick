import type { Mongoose } from "mongoose";

declare global {
  var mongooseCache:
    | { conn: Mongoose | null; promise: Promise<Mongoose> | null }
    | undefined;
}

export {};
