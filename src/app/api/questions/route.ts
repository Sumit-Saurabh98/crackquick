import { NextResponse } from "next/server";
import { HttpError, logAttempt, parseAttemptInput } from "@/lib/attempts";
import { catalogInput, findByProblemUrl, withCanonicalNames } from "@/lib/catalog";
import { listQuestions } from "@/lib/queries";
import { serializeQuestion } from "@/lib/serialize";
import { route } from "@/lib/viewer";
import { progressFor } from "@/models/Progress";
import { Question } from "@/models/Question";

export const GET = route(async (req, { viewer }) =>
  NextResponse.json(await listQuestions(req.nextUrl.searchParams, viewer)),
);

/**
 * Needs catalog.edit: adds a catalog question. `isStarred`, `status: "in_progress"` and
 * `backfill: { solvedAt, confidence }` (a solve done before using the app) apply to the creator's own progress.
 */
export const POST = route(
  async (req, { viewer }) => {
    const body = await req.json();
    const backfill = body.backfill ? parseAttemptInput({ ...body.backfill, outcome: "recalled" }) : null;
    if (backfill && !backfill.solvedAt) throw new HttpError("backfill.solvedAt is required", 400);

    const fields = await withCanonicalNames(catalogInput(body));
    if (!fields.title) throw new HttpError("Title is required.", 400);
    if (fields.platformUrl && (await findByProblemUrl(fields.platformUrl))) {
      throw new HttpError("That problem is already in the catalog.", 409);
    }
    const created = await Question.create({ ...fields, createdBy: viewer.id });

    if (body.isStarred || body.status === "in_progress") {
      const p = await progressFor(viewer.id, created._id);
      p.isStarred = Boolean(body.isStarred);
      if (body.status === "in_progress") p.status = "in_progress";
      await p.save();
    }
    if (backfill) {
      const { item } = await logAttempt(viewer.id, viewer.settings.intervals, String(created._id), backfill);
      return NextResponse.json({ item }, { status: 201 });
    }
    return NextResponse.json({ item: serializeQuestion(created.toObject(), null) }, { status: 201 });
  },
  { permission: "catalog.edit", errorStatus: 400 },
);
