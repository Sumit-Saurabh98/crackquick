import { NextResponse } from "next/server";
import { categoryConflict, categoryInput } from "@/lib/notes";
import type { CategoryJSON } from "@/lib/noteTypes";
import { route } from "@/lib/viewer";
import { Note } from "@/models/Note";
import { NoteCategory } from "@/models/NoteCategory";

function serializeCategory(doc: Record<string, unknown>, count = 0): CategoryJSON {
  return { _id: String(doc._id), name: String(doc.name), color: doc.color as CategoryJSON["color"], count };
}

/** The viewer's categories A–Z with their note counts, plus the total and uncategorized counts. */
export const GET = route(async (_req, { viewer }) => {
  const [docs, counts] = await Promise.all([
    NoteCategory.find({ userId: viewer.id }).collation({ locale: "en", strength: 2 }).sort({ name: 1 }).lean(),
    Note.aggregate<{ _id: unknown; n: number }>([{ $match: { userId: viewer.id } }, { $group: { _id: "$categoryId", n: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [c._id ? String(c._id) : "none", c.n]));
  return NextResponse.json({
    items: docs.map((d) => serializeCategory(d as Record<string, unknown>, byId.get(String(d._id)) ?? 0)),
    total: counts.reduce((s, c) => s + c.n, 0),
    uncategorized: byId.get("none") ?? 0,
  });
});

/** Body: { name, color? }. */
export const POST = route(
  async (req, { viewer }) => {
    const doc = await NoteCategory.create({ ...categoryInput(await req.json()), userId: viewer.id }).catch(categoryConflict);
    return NextResponse.json({ item: serializeCategory(doc.toObject()) }, { status: 201 });
  },
  { errorStatus: 400 },
);
