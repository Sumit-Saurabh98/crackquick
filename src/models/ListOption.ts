import mongoose, { Schema } from "mongoose";

/** A user-managed dropdown value, e.g. a coding platform ("LeetCode") or a pattern ("Two pointers"). */
const ListOptionSchema = new Schema(
  {
    kind: { type: String, enum: ["platform", "pattern"], required: true },
    name: { type: String, required: true, trim: true },
    /** Lower-cased name, for case-insensitive uniqueness. */
    key: { type: String, required: true },
  },
  { timestamps: true },
);

ListOptionSchema.index({ kind: 1, key: 1 }, { unique: true });

export const ListOption = mongoose.models.ListOption || mongoose.model("ListOption", ListOptionSchema);
