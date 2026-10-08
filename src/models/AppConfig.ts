import { Schema } from "mongoose";
import { defineModel } from "./model";

export const DEFAULT_REJECT_REASONS = [
  "Already in the catalog",
  "Premium-only problem",
  "Not a DSA problem",
  "Link doesn't work",
  "Not enough detail",
];

/** App-wide settings shared by everyone (one document, key "main"). */
const AppConfigSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    /** One-click reasons reviewers can reject a suggestion with. */
    rejectReasons: { type: [String], default: DEFAULT_REJECT_REASONS },
  },
  { timestamps: true },
);

export const AppConfig = defineModel("AppConfig", AppConfigSchema);

export async function getAppConfig() {
  const doc = await AppConfig.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return { rejectReasons: (doc?.rejectReasons ?? DEFAULT_REJECT_REASONS).map(String) };
}
