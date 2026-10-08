import { Schema } from "mongoose";
import { defineModel } from "./model";

/** Requests one user made of one kind within one fixed window, and how many were refused. */
const RateWindowSchema = new Schema({
  userId: { type: String, required: true },
  kind: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
  blocked: { type: Number, default: 0 },
  limit: { type: Number, default: 0 },
  /** Kept a week after the window ends, for the admin view; then MongoDB deletes it. */
  expiresAt: { type: Date, required: true },
});

RateWindowSchema.index({ userId: 1, kind: 1, windowStart: 1 }, { unique: true });
RateWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RateWindowSchema.index({ windowStart: -1 });

export const RateWindow = defineModel("RateWindow", RateWindowSchema);
