/** Client- and server-safe helpers for YouTube playlist links. */

export type Playlist = { id: string; name: string; url: string };

/**
 * "https://www.youtube.com/watch?v=EY8oryof0bU&list=RDEY8oryof0bU" → { videoId, listId }.
 * Accepts watch, playlist, youtu.be and music.youtube.com links. Needs at least a list or a video.
 */
export function parseYouTube(url: string): { videoId: string; listId: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    if (host !== "youtube.com" && host !== "youtu.be") return null;
    const videoId = host === "youtu.be" ? u.pathname.slice(1, 12) : (u.searchParams.get("v") ?? "");
    const listId = u.searchParams.get("list") ?? "";
    const valid = (s: string, rx: RegExp) => (rx.test(s) ? s : "");
    const v = valid(videoId, /^[A-Za-z0-9_-]{11}$/);
    const l = valid(listId, /^[A-Za-z0-9_-]{2,64}$/);
    return v || l ? { videoId: v, listId: l } : null;
  } catch {
    return null;
  }
}

/** Validates and tidies one { name, url }; throws a readable message if it's not usable. */
export function normalizePlaylist(raw: unknown): { name: string; url: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = String(r.name ?? "").trim().replace(/\s+/g, " ");
  const url = String(r.url ?? "").trim();
  if (!name) throw new Error("Playlist name is required.");
  if (!parseYouTube(url)) throw new Error(`"${name}": not a YouTube video or playlist link.`);
  return { name, url };
}
