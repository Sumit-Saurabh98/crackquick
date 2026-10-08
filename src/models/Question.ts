import mongoose, { Schema } from "mongoose";
import { defineModel } from "./model";

export const QUESTION_STATUSES = ["todo", "in_progress", "done"] as const;
export const QUESTION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

/** The shared catalog entry. Each user's own state on it lives in `Progress`. Only admins change these. */
const QuestionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    platform: { type: String, default: "LeetCode" },
    platformUrl: { type: String, default: "" },
    externalId: { type: String, default: "" },
    videoUrls: { type: [String], default: [] },
    // Legacy single link; read into videoUrls and cleared when the question is next edited.
    videoUrl: { type: String },
    topics: { type: [String], default: [] },
    companies: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: QUESTION_DIFFICULTIES,
      default: "Medium",
    },
    pattern: { type: String, default: "" },
    /** Taken out of the catalog by an admin; users who practised it keep their history. */
    retired: { type: Boolean, default: false },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

QuestionSchema.index({ retired: 1 });
QuestionSchema.index({ difficulty: 1 });
QuestionSchema.index({ topics: 1 });
QuestionSchema.index({ platformUrl: 1 });

export type QuestionDoc = mongoose.InferSchemaType<typeof QuestionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Question =
  defineModel("Question", QuestionSchema);
