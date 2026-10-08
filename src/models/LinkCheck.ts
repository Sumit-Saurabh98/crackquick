import { Schema } from "mongoose";
import { defineModel } from "./model";

/** The last check of one problem or video link from the catalog. */
const LinkCheckSchema = new Schema({
  url: { type: String, required: true, unique: true },
  kind: { type: String, enum: ["problem", "video"], required: true },
  /** "unknown": the site refused or timed out, so it's not reported as broken. */
  status: { type: String, enum: ["ok", "dead", "unknown"], required: true },
  reason: { type: String, default: "" },
  /** LeetCode Premium-only problem. */
  premium: { type: Boolean, default: false },
  checkedAt: { type: Date, required: true },
});

export const LinkCheck = defineModel("LinkCheck", LinkCheckSchema);
