import { Schema } from "mongoose";
import { defineModel } from "./model";
import { QUESTION_STATUSES } from "./Question";

/** One user's state on one catalog question. Created on the first change; absent means untouched. */
const ProgressSchema = new Schema(
  {
    userId: { type: String, required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    status: { type: String, enum: QUESTION_STATUSES, default: "todo" },
    timesSolved: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    lastSolvedAt: { type: Date, default: null },
    nextRevisionAt: { type: Date, default: null },
    revisionStage: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    timeSpentMinutes: { type: Number, default: 0 },
    totalMinutes: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    isStarred: { type: Boolean, default: false },
    /** Hidden from this user's lists and queue; history kept. */
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "progress" },
);

ProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true });
ProgressSchema.index({ questionId: 1 });

export const Progress = defineModel("Progress", ProgressSchema);

/** The fields copied into a progress record, and their values for a question never touched. */
export const PROGRESS_DEFAULTS = {
  status: "todo",
  timesSolved: 0,
  lapses: 0,
  lastSolvedAt: null,
  nextRevisionAt: null,
  revisionStage: 0,
  confidence: 0,
  timeSpentMinutes: 0,
  totalMinutes: 0,
  notes: "",
  isStarred: false,
  archived: false,
} as const;

/** The user's progress on a question, created if missing. */
export async function progressFor(userId: string, questionId: unknown) {
  return Progress.findOneAndUpdate(
    { userId, questionId },
    { $setOnInsert: { userId, questionId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).orFail();
}
