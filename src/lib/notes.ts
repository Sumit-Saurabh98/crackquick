import { Types } from "mongoose";
import { HttpError } from "./attempts";
import {
  CATEGORY_COLORS,
  IMAGE_URL_RE,
  MAX_CATEGORY_NAME,
  MAX_CONTENT_BYTES,
  MAX_TITLE,
  type CategoryColor,
  type NoteJSON,
  type NoteSummaryJSON,
} from "./noteTypes";
import { Note } from "@/models/Note";
import { NoteCategory } from "@/models/NoteCategory";
import { NoteImage } from "@/models/NoteImage";
import { Progress } from "@/models/Progress";

/** Uploads not used by any note are kept this long, so an unsaved draft doesn't lose its images. */
const ORPHAN_GRACE_MS = 24 * 3600_000;

function iso(v: unknown) {
  return v instanceof Date ? v.toISOString() : new Date(String(v ?? 0)).toISOString();
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function serializeNoteSummary(doc: Record<string, unknown>): NoteSummaryJSON {
  const text = String(doc.text ?? "");
  const excerpt = text.replace(/\s+/g, " ").trim();
  return {
    _id: String(doc._id),
    title: String(doc.title ?? ""),
    categoryId: doc.categoryId ? String(doc.categoryId) : null,
    excerpt: excerpt.length > 220 ? `${excerpt.slice(0, 220).trimEnd()}…` : excerpt,
    words: wordCount(text),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function serializeNote(doc: Record<string, unknown>): NoteJSON {
  return { ...serializeNoteSummary(doc), content: (doc.content as Record<string, unknown>) ?? { type: "doc", content: [] } };
}

/** Every uploaded-image id the document shows, from image nodes' `src`. */
function imageIdsIn(node: unknown, out = new Set<string>()) {
  if (!node || typeof node !== "object") return out;
  const n = node as { type?: unknown; attrs?: { src?: unknown }; content?: unknown };
  if (n.type === "image" && typeof n.attrs?.src === "string") {
    const m = IMAGE_URL_RE.exec(n.attrs.src);
    if (m) out.add(m[1]);
  }
  if (Array.isArray(n.content)) for (const c of n.content) imageIdsIn(c, out);
  return out;
}

/** The category id if it's one of the user's, null for none; 400 otherwise. */
async function ownCategory(userId: string, raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return null;
  const id = String(raw);
  if (!Types.ObjectId.isValid(id) || !(await NoteCategory.exists({ _id: id, userId }))) {
    throw new HttpError("That category doesn't exist.", 400);
  }
  return new Types.ObjectId(id);
}

/**
 * Validated note fields from a request body: { title, categoryId, content, text }. With `partial`,
 * only the fields present are returned.
 */
export async function noteInput(userId: string, body: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  if (!partial || "title" in body) {
    const title = String(body.title ?? "").trim();
    if (!title) throw new HttpError("Give the note a title.", 400);
    if (title.length > MAX_TITLE) throw new HttpError(`Titles can be up to ${MAX_TITLE} characters.`, 400);
    out.title = title;
  }
  if (!partial || "categoryId" in body) out.categoryId = await ownCategory(userId, body.categoryId);
  if (!partial || "content" in body) {
    const doc = docInput(body.content, body.text, "This note is too long (1 MB of text). Split it into two notes.");
    out.content = doc.content;
    out.text = doc.text;
    out.imageIds = doc.imageIds;
  }
  return out;
}

/** A validated editor document with its plain text and the uploaded images it shows; 400 if invalid. */
export function docInput(raw: unknown, text: unknown, tooLong: string) {
  const content = raw as { type?: unknown } | null;
  if (!content || typeof content !== "object" || content.type !== "doc") throw new HttpError("The note's content is invalid.", 400);
  if (Buffer.byteLength(JSON.stringify(content)) > MAX_CONTENT_BYTES) throw new HttpError(tooLong, 400);
  return {
    content: content as Record<string, unknown>,
    text: String(text ?? "").slice(0, 200_000),
    imageIds: [...imageIdsIn(content)].map((id) => new Types.ObjectId(id)),
  };
}

/** Validated category fields: { name, color }. */
export function categoryInput(body: Record<string, unknown>, partial = false) {
  const out: { name?: string; color?: CategoryColor } = {};
  if (!partial || "name" in body) {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw new HttpError("Give the category a name.", 400);
    if (name.length > MAX_CATEGORY_NAME) throw new HttpError(`Category names can be up to ${MAX_CATEGORY_NAME} characters.`, 400);
    out.name = name;
  }
  if (!partial || "color" in body) {
    const color = String(body.color ?? "brass");
    out.color = (color in CATEGORY_COLORS ? color : "brass") as CategoryColor;
  }
  return out;
}

/** A duplicate-name save as a readable 409. */
export function categoryConflict(e: unknown): never {
  if ((e as { code?: number }).code === 11000) throw new HttpError("You already have a category with that name.", 409);
  throw e;
}

/** Deletes the user's uploads that no note (or question note) shows any more (older than the grace period). */
export async function removeUnusedImages(userId: string) {
  const [inNotes, inQuestions] = await Promise.all([
    Note.distinct("imageIds", { userId }),
    Progress.distinct("notesImageIds", { userId }),
  ]);
  const used = [...inNotes, ...inQuestions];
  await NoteImage.deleteMany({
    uploadedBy: userId,
    _id: { $nin: used },
    createdAt: { $lt: new Date(Date.now() - ORPHAN_GRACE_MS) },
  });
}
