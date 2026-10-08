import { Schema, Types } from "mongoose";
import { defineModel } from "./model";
import { DEFAULT_REVISION_INTERVALS, DEFAULT_TIMEZONE } from "@/lib/constants";
import { isValidTimezone } from "@/lib/dates";
import { normalizeIntervals } from "@/lib/revision";
import type { Playlist } from "@/lib/youtube";

/** One document per user. */
const SettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    interviewDate: { type: Date, default: null },
    intervals: { type: [Number], default: DEFAULT_REVISION_INTERVALS },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    /** YouTube playlists for the music dock. */
    playlists: { type: [{ name: String, url: String }], default: [] },
  },
  { timestamps: true },
);

export const Settings = defineModel("Settings", SettingsSchema);

export type SettingsDoc = {
  interviewDate: Date | null;
  intervals: number[];
  timezone: string;
  playlists: Playlist[];
};

type StoredPlaylist = { _id?: unknown; name?: unknown; url?: unknown };

export function toPlaylists(raw: unknown): Playlist[] {
  return ((raw as StoredPlaylist[] | undefined) ?? []).map((p) => ({
    id: String(p._id ?? ""),
    name: String(p.name ?? ""),
    url: String(p.url ?? ""),
  }));
}

export async function getSettings(userId: string): Promise<SettingsDoc> {
  const doc = await Settings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, returnDocument: "after" },
  ).lean<Partial<Omit<SettingsDoc, "playlists">> & { playlists?: StoredPlaylist[] }>();
  // Older entries were saved without ids; give them one so they can be edited individually.
  if (doc?.playlists?.some((p) => !p._id)) {
    const withIds = doc.playlists.map((p) => ({ _id: p._id ?? new Types.ObjectId(), name: p.name, url: p.url }));
    await Settings.updateOne({ userId }, { $set: { playlists: withIds } });
    doc.playlists = withIds;
  }
  return {
    interviewDate: doc?.interviewDate ?? null,
    intervals: normalizeIntervals(doc?.intervals),
    timezone: doc?.timezone && isValidTimezone(doc.timezone) ? doc.timezone : DEFAULT_TIMEZONE,
    playlists: toPlaylists(doc?.playlists),
  };
}
