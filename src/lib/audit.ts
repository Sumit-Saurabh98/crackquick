import { randomUUID } from "node:crypto";
import { HttpError } from "./attempts";
import { CATALOG_KEYS, catalogOf, findByProblemUrl, type CatalogFields } from "./catalog";
import type { Viewer } from "./viewer";
import { AuditEntry } from "@/models/AuditEntry";
import { Question } from "@/models/Question";

/** What the audit log tracks on a question: its catalog fields plus `retired`. */
export type Snapshot = CatalogFields & { retired: boolean };
export type AuditSource = "manual" | "import" | "submission" | "bulk" | "backfill" | "revert";
type Change = { field: string; from: unknown; to: unknown };

const KEYS = [...CATALOG_KEYS, "retired"] as const;

export function snapshot(doc: Record<string, unknown>): Snapshot {
  return { ...catalogOf(doc), retired: Boolean(doc.retired) };
}

export function newBatchId() {
  return randomUUID();
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (v: unknown) => v === "" || v === false || v == null || (Array.isArray(v) && !v.length);

/**
 * The audit entry for one question going from `before` to `after` (null = didn't exist / deleted),
 * or null when nothing tracked changed.
 */
export function auditEntry(
  by: Pick<Viewer, "id" | "name" | "email">,
  question: { _id: unknown; title?: unknown },
  before: Snapshot | null,
  after: Snapshot | null,
  extra: { source?: AuditSource; submissionId?: unknown; batchId?: string; revertOf?: unknown } = {},
) {
  let action: "create" | "edit" | "retire" | "restore" | "delete";
  let changes: Change[];
  if (!before && after) {
    action = "create";
    changes = KEYS.filter((k) => !empty(after[k])).map((k) => ({ field: k, from: null, to: after[k] }));
  } else if (before && !after) {
    action = "delete";
    changes = KEYS.filter((k) => !empty(before[k])).map((k) => ({ field: k, from: before[k], to: null }));
  } else if (before && after) {
    changes = KEYS.filter((k) => !same(before[k], after[k])).map((k) => ({ field: k, from: before[k], to: after[k] }));
    if (!changes.length) return null;
    const onlyRetired = changes.length === 1 && changes[0].field === "retired";
    action = onlyRetired ? (after.retired ? "retire" : "restore") : "edit";
  } else return null;
  return {
    questionId: question._id,
    questionTitle: String(after?.title ?? before?.title ?? question.title ?? ""),
    action,
    changes,
    source: extra.source ?? "manual",
    userId: by.id,
    userName: by.name || by.email,
    submissionId: extra.submissionId ?? null,
    batchId: extra.batchId ?? "",
    revertOf: extra.revertOf ?? null,
  };
}

/** Records audit entries, skipping the nulls (no change). */
export async function audit(...entries: (ReturnType<typeof auditEntry> | null)[]) {
  const real = entries.filter((e) => e !== null);
  if (real.length) await AuditEntry.insertMany(real);
}

export type AuditJSON = {
  _id: string;
  questionId: string;
  questionTitle: string;
  action: "create" | "edit" | "retire" | "restore" | "delete";
  source: AuditSource;
  changes: Change[];
  userName: string;
  at: string;
  batchId: string;
  revertOf: string | null;
  revertedBy: string | null;
  /** Edits, retires and restores can be undone (once). */
  canRevert: boolean;
};

export function serializeAudit(d: Record<string, unknown>): AuditJSON {
  const action = d.action as AuditJSON["action"];
  return {
    _id: String(d._id),
    questionId: String(d.questionId),
    questionTitle: String(d.questionTitle ?? ""),
    action,
    source: (d.source as AuditSource) ?? "manual",
    changes: (d.changes as Change[]) ?? [],
    userName: String(d.userName ?? ""),
    at: new Date(d.at as Date).toISOString(),
    batchId: String(d.batchId ?? ""),
    revertOf: d.revertOf ? String(d.revertOf) : null,
    revertedBy: d.revertedBy ? String(d.revertedBy) : null,
    canRevert: (action === "edit" || action === "retire" || action === "restore") && !d.revertedBy,
  };
}

/**
 * Undoes one entry: puts each changed field back, but only if nobody has changed it again since
 * (otherwise the later change must be reverted first). Records the revert as its own entry.
 */
export async function revertEntry(viewer: Viewer, id: string) {
  const entry = await AuditEntry.findById(id);
  if (!entry) throw new HttpError("Change not found", 404);
  if (!["edit", "retire", "restore"].includes(entry.action)) {
    throw new HttpError("Only edits, retires and restores can be reverted.", 400);
  }
  if (entry.revertedBy) throw new HttpError("Already reverted.", 409);
  const q = await Question.findById(entry.questionId);
  if (!q) throw new HttpError("The question was deleted.", 409);

  const before = snapshot(q.toObject());
  const moved = entry.changes.filter((c) => !same(before[c.field as keyof Snapshot], c.to));
  if (moved.length) {
    throw new HttpError(`Changed again since: ${moved.map((c) => c.field).join(", ")}. Revert the later change first.`, 409);
  }
  const restore = Object.fromEntries(entry.changes.map((c) => [c.field, c.from]));
  if (typeof restore.platformUrl === "string" && restore.platformUrl && (await findByProblemUrl(restore.platformUrl, q._id))) {
    throw new HttpError("Another question now has that problem link.", 409);
  }
  q.set(restore);
  if ("videoUrls" in restore) q.videoUrl = undefined;
  await q.save();

  const record = auditEntry(viewer, q, before, snapshot(q.toObject()), { source: "revert", revertOf: entry._id });
  if (record) {
    const [created] = await AuditEntry.insertMany([record]);
    entry.revertedBy = created._id;
    await entry.save();
  }
  return q;
}
