import { NextResponse } from "next/server";
import { createSubmission, serializeSubmission } from "@/lib/submissions";
import { can, route } from "@/lib/viewer";
import { Submission } from "@/models/Submission";

/**
 * ?status=pending|approved|rejected (default: all). Reviewers (submissions.review) see everyone's
 * (?mine=1 for their own); others see their own. `pending` is the review-queue size, for reviewers.
 */
export const GET = route(async (req, { viewer }) => {
  const search = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = {};
  const reviewer = can(viewer, "submissions.review");
  if (!reviewer || search.get("mine") === "1") filter.userId = viewer.id;
  const status = search.get("status");
  if (status === "pending" || status === "approved" || status === "rejected") filter.status = status;
  const [docs, pending] = await Promise.all([
    Submission.find(filter).sort({ createdAt: status === "pending" ? 1 : -1 }).limit(200).lean(),
    reviewer ? Submission.countDocuments({ status: "pending" }) : Promise.resolve(0),
  ]);
  return NextResponse.json({
    items: docs.map((d) => serializeSubmission(d as Record<string, unknown>, viewer)),
    pending,
  });
});

/** Body: { kind: "new" | "edit", questionId? (for edit), note?, ...catalog fields } */
export const POST = route(
  async (req, { viewer }) => {
    const s = await createSubmission(viewer, await req.json());
    return NextResponse.json({ item: serializeSubmission(s.toObject(), viewer) }, { status: 201 });
  },
  { errorStatus: 400 },
);
