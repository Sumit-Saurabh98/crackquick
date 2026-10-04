import mongoose, { Schema } from "mongoose";
import { defineModel } from "./model";

export const QUESTION_STATUSES = ["todo", "in_progress", "done"] as const;
export const QUESTION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

const QuestionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    platform: { type: String, default: "LeetCode" },
    platformUrl: { type: String, default: "" },
    externalId: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
    topics: { type: [String], default: [] },
    companies: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: QUESTION_DIFFICULTIES,
      default: "Medium",
    },
    status: { type: String, enum: QUESTION_STATUSES, default: "todo" },
    timesSolved: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    lastSolvedAt: { type: Date, default: null },
    nextRevisionAt: { type: Date, default: null },
    revisionStage: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    timeSpentMinutes: { type: Number, default: 0 },
    totalMinutes: { type: Number, default: 0 },
    pattern: { type: String, default: "" },
    isStarred: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

QuestionSchema.index({ archived: 1, status: 1, nextRevisionAt: 1 });
QuestionSchema.index({ difficulty: 1 });
QuestionSchema.index({ topics: 1 });
QuestionSchema.index({ lastSolvedAt: 1 });
QuestionSchema.index({ platformUrl: 1 });

export type QuestionDoc = mongoose.InferSchemaType<typeof QuestionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Question =
  defineModel("Question", QuestionSchema);
