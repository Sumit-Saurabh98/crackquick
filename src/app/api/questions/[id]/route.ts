import { NextRequest, NextResponse } from "next/server";
import { csv, fail, notFoundUnlessValidId } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { serializeQuestion } from "@/lib/serialize";
import { ActivityEvent } from "@/models/Event";
import { Question } from "@/models/Question";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "title",
  "platform",
  "platformUrl",
  "externalId",
  "videoUrl",
  "notes",
  "difficulty",
  "sourceList",
  "isStarred",
  "archived",
] as const;

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    const doc = await Question.findById(id).lean();
    if (!doc) return fail(new Error("Question not found"), 404);
    return NextResponse.json({ item: serializeQuestion(doc as Record<string, unknown>) });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Scheduling fields only change through attempts. Status can be reset to todo / in_progress
 * (which takes the question out of the review queue) but never set to done directly.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    const body = await req.json();
    const q = await Question.findById(id);
    if (!q) return fail(new Error("Question not found"), 404);

    for (const k of EDITABLE) {
      if (body[k] !== undefined) q.set(k, body[k]);
    }
    if (body.topics !== undefined) q.topics = csv(body.topics);
    if (body.companies !== undefined) q.companies = csv(body.companies);

    if (body.status !== undefined && body.status !== q.status) {
      if (body.status === "done") {
        return fail(new Error("Log an attempt to mark a question done."), 400);
      }
      if (body.status !== "todo" && body.status !== "in_progress") {
        return fail(new Error("Invalid status."), 400);
      }
      q.status = body.status;
      q.nextRevisionAt = null;
      q.revisionStage = 0;
    }

    await q.save();
    return NextResponse.json({ item: serializeQuestion(q.toObject()) });
  } catch (e) {
    return fail(e, 400);
  }
}

/** Hard delete: removes the question and its attempt history. Archive (PATCH archived) keeps history. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    await Question.findByIdAndDelete(id);
    await ActivityEvent.deleteMany({ questionId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
