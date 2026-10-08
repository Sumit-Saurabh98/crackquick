import { Types } from "mongoose";
import { HttpError } from "./attempts";
import { normalizePlaylist, type Playlist } from "./youtube";
import { getSettings, Settings, toPlaylists } from "@/models/Settings";

/**
 * Each change touches only the playlist it's about (never "replace the whole list"), so a page
 * left open with an old copy can't wipe playlists added elsewhere. Every call returns the fresh list.
 */

function validated(raw: unknown) {
  try {
    return normalizePlaylist(raw);
  } catch (e) {
    throw new HttpError(e instanceof Error ? e.message : "Invalid playlist", 400);
  }
}

function checkId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError("Playlist not found.", 404);
  return new Types.ObjectId(id);
}

export async function listPlaylists(userId: string): Promise<Playlist[]> {
  return (await getSettings(userId)).playlists;
}

export async function addPlaylist(userId: string, raw: unknown) {
  const p = validated(raw);
  await Settings.updateOne({ userId }, { $push: { playlists: { _id: new Types.ObjectId(), ...p } } }, { upsert: true });
  return listPlaylists(userId);
}

export async function updatePlaylist(userId: string, id: string, raw: unknown) {
  const p = validated(raw);
  const r = await Settings.updateOne(
    { userId, "playlists._id": checkId(id) },
    { $set: { "playlists.$.name": p.name, "playlists.$.url": p.url } },
  );
  if (!r.matchedCount) throw new HttpError("Playlist not found (deleted elsewhere?). Reload.", 404);
  return listPlaylists(userId);
}

export async function deletePlaylist(userId: string, id: string) {
  await Settings.updateOne({ userId }, { $pull: { playlists: { _id: checkId(id) } } });
  return listPlaylists(userId);
}

/** Swaps the playlist with its neighbour; only applies if the list hasn't changed meanwhile. */
export async function movePlaylist(userId: string, id: string, dir: -1 | 1) {
  const doc = await Settings.findOne({ userId }, { playlists: 1 }).lean<{ playlists?: { _id: Types.ObjectId }[] }>();
  const list = doc?.playlists ?? [];
  const i = list.findIndex((p) => String(p._id) === id);
  if (i < 0) throw new HttpError("Playlist not found (deleted elsewhere?). Reload.", 404);
  const j = i + dir;
  if (j < 0 || j >= list.length) return toPlaylists(list);
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  const r = await Settings.updateOne({ userId, playlists: list }, { $set: { playlists: next } });
  if (!r.matchedCount) throw new HttpError("Playlists changed meanwhile. Try again.", 409);
  return listPlaylists(userId);
}
