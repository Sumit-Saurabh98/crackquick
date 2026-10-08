import { HttpError } from "./attempts";
import { audit, auditEntry, snapshot } from "./audit";
import { catalogInput, catalogOf, diffCatalog, findByProblemUrl, withCanonicalNames, type CatalogFields } from "./catalog";
import { can, type Viewer } from "./viewer";
import { Question } from "@/models/Question";
import { Submission } from "@/models/Submission";

export type SubmissionJSON = {
  _id: string;
  kind: "new" | "edit";
  status: "pending" | "approved" | "rejected";
  userName: string;
  userEmail: string;
  mine: boolean;
  questionId: string | null;
  questionTitle: string;
  data: Partial<CatalogFields>;
  before: Partial<CatalogFields>;
  note: string;
  reviewNote: string;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeSubmission(doc: Record<string, unknown>, viewer: Viewer): SubmissionJSON {
  const date = (v: unknown) => (v ? new Date(v as Date).toISOString() : null);
  return {
    _id: String(doc._id),
    kind: doc.kind as SubmissionJSON["kind"],
    status: doc.status as SubmissionJSON["status"],
    userName: String(doc.userName ?? ""),
    // Other users' emails are for reviewers only.
    userEmail: can(viewer, "submissions.review") || doc.userId === viewer.id ? String(doc.userEmail ?? "") : "",
    mine: doc.userId === viewer.id,
    questionId: doc.questionId ? String(doc.questionId) : null,
    questionTitle: String(doc.questionTitle ?? ""),
    data: (doc.data ?? {}) as Partial<CatalogFields>,
    before: (doc.before ?? {}) as Partial<CatalogFields>,
    note: String(doc.note ?? ""),
    reviewNote: String(doc.reviewNote ?? ""),
    createdAt: date(doc.createdAt) ?? new Date().toISOString(),
    reviewedAt: date(doc.reviewedAt),
  };
}

const ONE_AT_A_TIME =
  "You already have a question waiting for review. You can suggest another once it's approved or rejected.";

const note = (v: unknown) => String(v ?? "").trim().slice(0, 2000);

/** A new question for the catalog, or changes to one, waiting for an admin. */
export async function createSubmission(viewer: Viewer, body: Record<string, unknown>) {
  const kind = body.kind === "edit" ? "edit" : "new";
  const fields = catalogInput(body);
  const who = { userId: viewer.id, userName: viewer.name, userEmail: viewer.email, note: note(body.note) };

  if (kind === "new") {
    // One new question waiting at a time per user; the next is allowed once it's approved or rejected.
    if (await Submission.exists({ userId: viewer.id, kind: "new", status: "pending" })) {
      throw new HttpError(ONE_AT_A_TIME, 409);
    }
    if (!fields.title) throw new HttpError("Title is required.", 400);
    if (fields.platformUrl) {
      if (await findByProblemUrl(fields.platformUrl)) throw new HttpError("That problem is already in the catalog.", 409);
    }
    try {
      return await Submission.create({ kind, ...who, questionTitle: fields.title, data: fields });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new HttpError(ONE_AT_A_TIME, 409);
      throw e;
    }
  }

  const q = await Question.findById(String(body.questionId ?? "")).lean().catch(() => null);
  if (!q || q.retired) throw new HttpError("Question not found", 404);
  const { data, before } = diffCatalog(catalogOf(q as Record<string, unknown>), fields);
  if (!Object.keys(data).length) throw new HttpError("Nothing changed. Edit a field to suggest a change.", 400);
  return Submission.create({ kind, ...who, questionId: q._id, questionTitle: q.title, data, before });
}

/** Approve (applies it to the catalog) or reject a pending submission. */
export async function reviewSubmission(viewer: Viewer, id: string, action: unknown, reviewNote: unknown) {
  const s = await Submission.findById(id);
  if (!s) throw new HttpError("Submission not found", 404);
  if (s.status !== "pending") throw new HttpError(`Already ${s.status}.`, 409);
  if (action !== "approve" && action !== "reject") throw new HttpError("action must be approve or reject.", 400);

  if (action === "approve") {
    const fields = await withCanonicalNames(catalogInput(s.data as Record<string, unknown>));
    if (s.kind === "new") {
      if (fields.platformUrl && (await findByProblemUrl(fields.platformUrl))) {
        throw new HttpError("That problem is in the catalog now. Reject this one.", 409);
      }
      const q = await Question.create({ ...fields, createdBy: s.userId });
      s.questionId = q._id;
      await audit(auditEntry(viewer, q, null, snapshot(q.toObject()), { source: "submission", submissionId: s._id }));
    } else {
      const q = await Question.findById(s.questionId);
      if (!q) throw new HttpError("The question was deleted. Reject this one.", 409);
      if (fields.platformUrl && (await findByProblemUrl(fields.platformUrl, q._id))) {
        throw new HttpError("Another question already has that problem link.", 409);
      }
      const before = snapshot(q.toObject());
      q.set(fields);
      if (fields.videoUrls) q.videoUrl = undefined;
      await q.save();
      await audit(auditEntry(viewer, q, before, snapshot(q.toObject()), { source: "submission", submissionId: s._id }));
    }
  }
  s.status = action === "approve" ? "approved" : "rejected";
  s.reviewNote = note(reviewNote);
  s.reviewedAt = new Date();
  s.reviewedBy = viewer.id;
  await s.save();
  return s;
}
