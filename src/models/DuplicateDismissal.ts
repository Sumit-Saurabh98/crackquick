import { Schema } from "mongoose";
import { defineModel } from "./model";

/** A pair a catalog editor marked "not duplicates"; the finder skips it. Ids stored sorted. */
const DuplicateDismissalSchema = new Schema({
  a: { type: Schema.Types.ObjectId, required: true },
  b: { type: Schema.Types.ObjectId, required: true },
  userId: { type: String, default: "" },
  at: { type: Date, default: Date.now },
});

DuplicateDismissalSchema.index({ a: 1, b: 1 }, { unique: true });

export const DuplicateDismissal = defineModel("DuplicateDismissal", DuplicateDismissalSchema);
