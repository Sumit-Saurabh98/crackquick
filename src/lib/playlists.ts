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

export async function listPlaylists(): Promise<Playlist[]> {
  return (await getSettings()).playlists;
}

export async function addPlaylist(raw: unknown) {
  const p = validated(raw);
  await getSettings(); // ensures the settings document exists
  await Settings.updateOne({ key: "main" }, { $push: { playlists: { _id: new Types.ObjectId(), ...p } } });
  return listPlaylists();
}

export async function updatePlaylist(id: string, raw: unknown) {
  const p = validated(raw);
  const r = await Settings.updateOne(
    { key: "main", "playlists._id": checkId(id) },
    { $set: { "playlists.$.name": p.name, "playlists.$.url": p.url } },
  );
  if (!r.matchedCount) throw new HttpError("Playlist not found (deleted elsewhere?). Reload.", 404);
  return listPlaylists();
}

export async function deletePlaylist(id: string) {
  await Settings.updateOne({ key: "main" }, { $pull: { playlists: { _id: checkId(id) } } });
  return listPlaylists();
}

/** Swaps the playlist with its neighbour; only applies if the list hasn't changed meanwhile. */
export async function movePlaylist(id: string, dir: -1 | 1) {
  const doc = await Settings.findOne({ key: "main" }, { playlists: 1 }).lean<{ playlists?: { _id: Types.ObjectId }[] }>();
  const list = doc?.playlists ?? [];
  const i = list.findIndex((p) => String(p._id) === id);
  if (i < 0) throw new HttpError("Playlist not found (deleted elsewhere?). Reload.", 404);
  const j = i + dir;
  if (j < 0 || j >= list.length) return toPlaylists(list);
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  const r = await Settings.updateOne({ key: "main", playlists: list }, { $set: { playlists: next } });
  if (!r.matchedCount) throw new HttpError("Playlists changed meanwhile. Try again.", 409);
  return listPlaylists();
}
