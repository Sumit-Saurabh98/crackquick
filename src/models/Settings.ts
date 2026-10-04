import mongoose, { Schema } from "mongoose";
import { DEFAULT_REVISION_INTERVALS, DEFAULT_TIMEZONE } from "@/lib/constants";
import { isValidTimezone } from "@/lib/dates";
import { normalizeIntervals } from "@/lib/revision";

/** Singleton document (key = "main"). */
const SettingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    interviewDate: { type: Date, default: null },
    intervals: { type: [Number], default: DEFAULT_REVISION_INTERVALS },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
  },
  { timestamps: true },
);

export const Settings = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);

export type SettingsDoc = {
  interviewDate: Date | null;
  intervals: number[];
  timezone: string;
};

export async function getSettings(): Promise<SettingsDoc> {
  const doc = await Settings.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, returnDocument: "after" },
  ).lean<Partial<SettingsDoc>>();
  return {
    interviewDate: doc?.interviewDate ?? null,
    intervals: normalizeIntervals(doc?.intervals),
    timezone: doc?.timezone && isValidTimezone(doc.timezone) ? doc.timezone : DEFAULT_TIMEZONE,
  };
}
