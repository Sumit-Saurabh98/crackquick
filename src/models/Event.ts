import mongoose, { Schema } from "mongoose";

/** Scheduling fields of a question before an attempt, for "Undo last log". */
const SnapshotSchema = new Schema(
  {
    status: String,
    timesSolved: Number,
    lapses: Number,
    lastSolvedAt: Date,
    nextRevisionAt: Date,
    revisionStage: Number,
    confidence: Number,
    timeSpentMinutes: Number,
    totalMinutes: Number,
  },
  { _id: false },
);

const EventSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    type: {
      type: String,
      enum: ["solved", "revised", "failed_recall"],
      required: true,
    },
    at: { type: Date, default: Date.now },
    confidence: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },
    onTime: { type: Boolean, default: true },
    difficulty: { type: String, default: "Medium" },
    backfill: { type: Boolean, default: false },
    prev: { type: SnapshotSchema, default: null },
  },
  { timestamps: false },
);

EventSchema.index({ at: 1 });
EventSchema.index({ questionId: 1, at: -1 });

export const ActivityEvent =
  mongoose.models.ActivityEvent || mongoose.model("ActivityEvent", EventSchema);
