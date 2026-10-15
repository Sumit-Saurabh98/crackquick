import { NextResponse } from "next/server";
import { noteInput, removeUnusedImages, serializeNote, serializeNoteSummary } from "@/lib/notes";
import { route } from "@/lib/viewer";
import { Note } from "@/models/Note";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The viewer's notes, last edited first, without their content. ?category=<id> or ?category=none
 * (uncategorized) narrows to one category; ?q= searches titles and text.
 */
export const GET = route(async (req, { viewer }) => {
  const sp = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = { userId: viewer.id };
  const category = sp.get("category");
  if (category === "none") filter.categoryId = null;
  else if (category && /^[a-f0-9]{24}$/.test(category)) filter.categoryId = category;
  const q = sp.get("q")?.trim();
  if (q) {
    const re = new RegExp(escapeRegex(q.slice(0, 100)), "i");
    filter.$or = [{ title: re }, { text: re }];
  }
  const docs = await Note.find(filter, { content: 0, imageIds: 0 }).sort({ updatedAt: -1 }).limit(500).lean();
  return NextResponse.json({ items: docs.map((d) => serializeNoteSummary(d as Record<string, unknown>)) });
});

/** Body: { title, categoryId?, content (editor JSON), text (plain text) }. */
export const POST = route(
  async (req, { viewer }) => {
    const doc = await Note.create({ ...(await noteInput(viewer.id, await req.json())), userId: viewer.id });
    await removeUnusedImages(viewer.id);
    return NextResponse.json({ item: serializeNote(doc.toObject()) }, { status: 201 });
  },
  { errorStatus: 400 },
);
