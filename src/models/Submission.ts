import { Schema } from "mongoose";
import { defineModel } from "./model";

/**
 * A user's proposal: a new catalog question, or changes to an existing one. Nothing reaches the
 * catalog until an admin approves it.
 */
const SubmissionSchema = new Schema(
  {
    kind: { type: String, enum: ["new", "edit"], required: true },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", default: null },
    questionTitle: { type: String, default: "" },
    /** Proposed catalog fields: all of them for "new", only the changed ones for "edit". */
    data: { type: Schema.Types.Mixed, default: {} },
    /** For "edit": the same fields as they were when submitted. */
    before: { type: Schema.Types.Mixed, default: {} },
    note: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

SubmissionSchema.index({ status: 1, createdAt: -1 });
SubmissionSchema.index({ userId: 1, createdAt: -1 });
// At most one new-question suggestion waiting per user (also guards two submits at the same moment).
SubmissionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { kind: "new", status: "pending" }, name: "one_pending_new_per_user" },
);

export const Submission = defineModel("Submission", SubmissionSchema);
