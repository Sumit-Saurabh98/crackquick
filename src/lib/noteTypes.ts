/** Notes types and limits shared by the browser and the server (no server imports here). */

export const CATEGORY_COLORS = {
  brass: "#e0b366",
  green: "#3dba8b",
  coral: "#e07a5f",
  sky: "#5fa8e0",
  violet: "#a78bfa",
  pink: "#e879b0",
  slate: "#8b97a8",
} as const;

export type CategoryColor = keyof typeof CATEGORY_COLORS;

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Image URLs inside a note that point at an upload; group 1 is the id. */
export const IMAGE_URL_RE = /^\/api\/notes\/images\/([a-f0-9]{24})$/;

export const MAX_TITLE = 200;
export const MAX_CATEGORY_NAME = 40;
/** Size of a note's document as JSON. Images are stored separately, so this is text, tables and embeds only. */
export const MAX_CONTENT_BYTES = 1024 * 1024;

export type CategoryJSON = { _id: string; name: string; color: CategoryColor; count: number };

export type NoteSummaryJSON = {
  _id: string;
  title: string;
  categoryId: string | null;
  excerpt: string;
  words: number;
  createdAt: string;
  updatedAt: string;
};

export type NoteJSON = NoteSummaryJSON & { content: Record<string, unknown> };

/** Minutes to read at ~220 words a minute, at least 1. */
export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 220));
}
