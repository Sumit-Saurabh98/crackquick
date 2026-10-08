import mongoose from "mongoose";
import { HttpError } from "./attempts";
import { audit, auditEntry, newBatchId, snapshot } from "./audit";
import { DIFFICULTIES } from "./constants";
import { canonicalName } from "./options";
import { matchingQuestionIds } from "./queries";
import type { Viewer } from "./viewer";
import { Question } from "@/models/Question";

export const BULK_ACTIONS = {
  setPattern: "Set pattern",
  setDifficulty: "Set difficulty",
  addTopic: "Add topic",
  removeTopic: "Remove topic",
  addCompany: "Add company",
  removeCompany: "Remove company",
  retire: "Retire",
  restore: "Restore",
} as const;

export type BulkAction = keyof typeof BULK_ACTIONS;

const MAX = 5000;

/** The questions a bulk request targets: explicit `ids`, or every match of the list filters in `query`. */
export async function bulkTargets(viewer: Viewer, body: Record<string, unknown>) {
  let ids: unknown[];
  if (Array.isArray(body.ids)) {
    ids = body.ids.map(String).filter((id) => mongoose.isValidObjectId(id));
  } else if (typeof body.query === "string") {
    ids = await matchingQuestionIds(new URLSearchParams(body.query), viewer, MAX);
  } else throw new HttpError("Send ids or query.", 400);
  if (!ids.length) throw new HttpError("No questions selected.", 400);
  if (ids.length > MAX) throw new HttpError(`Too many at once (max ${MAX}). Narrow the filters.`, 400);
  return ids;
}

const hasName = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());

/** Applies one action to many questions; each changed question gets its own audit entry (one batch). */
export async function applyBulk(viewer: Viewer, ids: unknown[], rawAction: unknown, rawValue: unknown) {
  const action = (Object.keys(BULK_ACTIONS) as BulkAction[]).find((a) => a === rawAction);
  if (!action) throw new HttpError("Unknown bulk action.", 400);
  let value = String(rawValue ?? "").trim().replace(/\s+/g, " ");
  if (["addTopic", "removeTopic", "addCompany", "removeCompany"].includes(action) && !value) {
    throw new HttpError("Enter a value.", 400);
  }
  if (action === "setDifficulty" && !DIFFICULTIES.some((d) => d === value)) throw new HttpError("Pick a difficulty.", 400);
  if (action === "setPattern") value = await canonicalName("pattern", value); // "" clears it

  const docs = await Question.find({ _id: { $in: ids } });
  const batchId = newBatchId();
  const writes = [];
  const entries = [];
  for (const q of docs) {
    const before = snapshot(q.toObject());
    const topics = [...before.topics];
    const companies = [...before.companies];
    switch (action) {
      case "setPattern":
        q.pattern = value;
        break;
      case "setDifficulty":
        q.difficulty = value as (typeof DIFFICULTIES)[number];
        break;
      case "addTopic":
        if (!hasName(topics, value)) q.topics = [...topics, value];
        break;
      case "removeTopic":
        q.topics = topics.filter((t) => t.toLowerCase() !== value.toLowerCase());
        break;
      case "addCompany":
        if (!hasName(companies, value)) q.companies = [...companies, value];
        break;
      case "removeCompany":
        q.companies = companies.filter((c) => c.toLowerCase() !== value.toLowerCase());
        break;
      case "retire":
      case "restore":
        q.retired = action === "retire";
        break;
    }
    const entry = auditEntry(viewer, q, before, snapshot(q.toObject()), { source: "bulk", batchId });
    if (!entry) continue;
    entries.push(entry);
    writes.push({ updateOne: { filter: { _id: q._id }, update: { $set: q.getChanges().$set ?? {} } } });
  }
  if (writes.length) await Question.bulkWrite(writes);
  await audit(...entries);
  return { matched: docs.length, changed: writes.length, batchId };
}
