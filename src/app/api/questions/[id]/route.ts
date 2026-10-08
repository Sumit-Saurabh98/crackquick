import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { catalogInput, findByProblemUrl, withCanonicalNames } from "@/lib/catalog";
import { checkId } from "@/lib/http";
import { serializeQuestion } from "@/lib/serialize";
import { requirePermission, route } from "@/lib/viewer";
import { ActivityEvent } from "@/models/Event";
import { Progress, progressFor } from "@/models/Progress";
import { Question } from "@/models/Question";
import { Submission } from "@/models/Submission";

type P = { id: string };

async function load(id: string) {
  const q = await Question.findById(checkId(id, "Question not found"));
  if (!q) throw new HttpError("Question not found", 404);
  return q;
}

export const GET = route<P>(async (_req, { viewer, params }) => {
  const q = await load(params.id);
  const p = await Progress.findOne({ userId: viewer.id, questionId: q._id }).lean();
  return NextResponse.json({ item: serializeQuestion(q.toObject(), p) });
});

/**
 * Anyone, on their own progress: notes, isStarred, archived (hide for me), status (reset to todo /
 * in_progress; done only comes from logging an attempt, and resetting clears the schedule).
 * Needs catalog.edit: catalog fields (title, link, videos, topics, companies, difficulty, pattern, …) and `retired`.
 */
export const PATCH = route<P>(
  async (req, { viewer, params }) => {
    const body = await req.json();
    const q = await load(params.id);

    const catalog = catalogInput(body);
    if (Object.keys(catalog).length || body.retired !== undefined) {
      requirePermission(viewer, "catalog.edit");
      const fields = await withCanonicalNames(catalog);
      if (fields.platformUrl && (await findByProblemUrl(fields.platformUrl, q._id))) {
        throw new HttpError("Another question already has that problem link.", 409);
      }
      q.set(fields);
      if (fields.videoUrls) q.videoUrl = undefined;
      if (body.retired !== undefined) q.retired = Boolean(body.retired);
      await q.save();
    }

    const personal = ["notes", "isStarred", "archived", "status"].some((k) => body[k] !== undefined);
    let p = personal ? await progressFor(viewer.id, q._id) : null;
    if (p) {
      if (body.notes !== undefined) p.notes = String(body.notes);
      if (body.isStarred !== undefined) p.isStarred = Boolean(body.isStarred);
      if (body.archived !== undefined) p.archived = Boolean(body.archived);
      if (body.status !== undefined && body.status !== p.status) {
        if (body.status === "done") throw new HttpError("Log an attempt to mark a question done.", 400);
        if (body.status !== "todo" && body.status !== "in_progress") throw new HttpError("Invalid status.", 400);
        p.status = body.status;
        p.nextRevisionAt = null;
        p.revisionStage = 0;
      }
      await p.save();
    } else {
      p = await Progress.findOne({ userId: viewer.id, questionId: q._id });
    }
    return NextResponse.json({ item: serializeQuestion(q.toObject(), p?.toObject() ?? null) });
  },
  { errorStatus: 400 },
);

/**
 * Needs catalog.delete: removes the question with everyone's progress and attempts on it. Refused while other users
 * have attempts on it, so nobody loses history; retire it instead.
 */
export const DELETE = route<P>(
  async (_req, { viewer, params }) => {
    const q = await load(params.id);
    const others = (await ActivityEvent.distinct("userId", { questionId: q._id })).filter((u) => u !== viewer.id);
    if (others.length) {
      throw new HttpError(
        `${others.length} other user${others.length === 1 ? " has" : "s have"} practised this. Retire it instead to keep their history.`,
        409,
      );
    }
    await Promise.all([
      q.deleteOne(),
      Progress.deleteMany({ questionId: q._id }),
      ActivityEvent.deleteMany({ questionId: q._id }),
      Submission.deleteMany({ questionId: q._id, status: "pending" }),
    ]);
    return NextResponse.json({ ok: true });
  },
  { permission: "catalog.delete" },
);
