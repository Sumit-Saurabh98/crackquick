import { Schema } from "mongoose";
import { defineModel } from "./model";

/** One change to the catalog: who did what to which question, with each field's old and new value. */
const ChangeSchema = new Schema({ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed }, { _id: false });

const AuditEntrySchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    /** Kept so the feed still reads well after a question is deleted or renamed. */
    questionTitle: { type: String, default: "" },
    action: { type: String, enum: ["create", "edit", "retire", "restore", "delete"], required: true },
    /** How it happened: by hand, JSON / LeetCode import, an approved suggestion, a bulk action, … */
    source: {
      type: String,
      enum: ["manual", "import", "submission", "bulk", "backfill", "revert", "merge"],
      default: "manual",
    },
    changes: { type: [ChangeSchema], default: [] },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    submissionId: { type: Schema.Types.ObjectId, default: null },
    /** Shared by every entry of one bulk action or import. */
    batchId: { type: String, default: "" },
    /** For a revert: the entry it undid. */
    revertOf: { type: Schema.Types.ObjectId, default: null },
    /** Set on an entry once it has been reverted. */
    revertedBy: { type: Schema.Types.ObjectId, default: null },
    at: { type: Date, default: Date.now },
  },
  { minimize: false },
);

AuditEntrySchema.index({ questionId: 1, at: -1 });
AuditEntrySchema.index({ at: -1 });

export const AuditEntry = defineModel("AuditEntry", AuditEntrySchema);
