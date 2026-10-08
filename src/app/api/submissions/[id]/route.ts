import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { reviewSubmission, serializeSubmission } from "@/lib/submissions";
import { route } from "@/lib/viewer";
import { Submission } from "@/models/Submission";

type P = { id: string };

/** Needs submissions.review. Body: { action: "approve" | "reject", reviewNote? } */
export const PATCH = route<P>(
  async (req, { viewer, params }) => {
    const body = await req.json();
    const s = await reviewSubmission(viewer, checkId(params.id, "Submission not found"), body.action, body.reviewNote);
    return NextResponse.json({ item: serializeSubmission(s.toObject(), viewer) });
  },
  { permission: "submissions.review", errorStatus: 400 },
);

/** Withdraw your own pending submission. */
export const DELETE = route<P>(async (_req, { viewer, params }) => {
  const r = await Submission.deleteOne({
    _id: checkId(params.id, "Submission not found"),
    userId: viewer.id,
    status: "pending",
  });
  if (!r.deletedCount) throw new HttpError("Only your own pending submissions can be withdrawn.", 404);
  return NextResponse.json({ ok: true });
});
