import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { noteInput, removeUnusedImages, serializeNote } from "@/lib/notes";
import { route } from "@/lib/viewer";
import { Note } from "@/models/Note";

type P = { id: string };

/** One of the viewer's notes, with its content. Other users' notes are 404. */
export const GET = route<P>(async (_req, { viewer, params }) => {
  const doc = await Note.findOne({ _id: checkId(params.id, "Note not found"), userId: viewer.id }).lean();
  if (!doc) throw new HttpError("Note not found", 404);
  return NextResponse.json({ item: serializeNote(doc as Record<string, unknown>) });
});

/** Any of { title, categoryId, content + text } to change. */
export const PATCH = route<P>(
  async (req, { viewer, params }) => {
    const doc = await Note.findOne({ _id: checkId(params.id, "Note not found"), userId: viewer.id });
    if (!doc) throw new HttpError("Note not found", 404);
    doc.set(await noteInput(viewer.id, await req.json(), true));
    doc.markModified("content");
    await doc.save();
    await removeUnusedImages(viewer.id);
    return NextResponse.json({ item: serializeNote(doc.toObject()) });
  },
  { errorStatus: 400 },
);

export const DELETE = route<P>(async (_req, { viewer, params }) => {
  const r = await Note.deleteOne({ _id: checkId(params.id, "Note not found"), userId: viewer.id });
  if (!r.deletedCount) throw new HttpError("Note not found", 404);
  await removeUnusedImages(viewer.id);
  return NextResponse.json({ ok: true });
});
