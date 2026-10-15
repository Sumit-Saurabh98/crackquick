import { Schema } from "mongoose";
import { defineModel } from "./model";

/** A folder for one user's notes. Names are unique per user, ignoring case. */
const NoteCategorySchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "brass" },
  },
  { timestamps: true },
);

NoteCategorySchema.index({ userId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const NoteCategory = defineModel("NoteCategory", NoteCategorySchema);
