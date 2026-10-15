import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { categoryConflict, categoryInput } from "@/lib/notes";
import { route } from "@/lib/viewer";
import { Note } from "@/models/Note";
import { NoteCategory } from "@/models/NoteCategory";

type P = { id: string };

/** Rename or recolour: { name?, color? }. */
export const PATCH = route<P>(
  async (req, { viewer, params }) => {
    const doc = await NoteCategory.findOne({ _id: checkId(params.id, "Category not found"), userId: viewer.id });
    if (!doc) throw new HttpError("Category not found", 404);
    doc.set(categoryInput(await req.json(), true));
    await doc.save().catch(categoryConflict);
    return NextResponse.json({ ok: true });
  },
  { errorStatus: 400 },
);

/** Deletes the category; its notes are kept and become uncategorized. */
export const DELETE = route<P>(async (_req, { viewer, params }) => {
  const id = checkId(params.id, "Category not found");
  const r = await NoteCategory.deleteOne({ _id: id, userId: viewer.id });
  if (!r.deletedCount) throw new HttpError("Category not found", 404);
  const moved = await Note.updateMany({ userId: viewer.id, categoryId: id }, { $set: { categoryId: null } }, { timestamps: false });
  return NextResponse.json({ ok: true, moved: moved.modifiedCount });
});
