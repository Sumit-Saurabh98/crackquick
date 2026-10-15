import { Schema } from "mongoose";
import { defineModel } from "./model";

/** An image uploaded into a note, stored in the database and served by id to its owner only. */
const NoteImageSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    name: { type: String, default: "" },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true },
);

NoteImageSchema.index({ uploadedBy: 1, createdAt: 1 });

export const NoteImage = defineModel("NoteImage", NoteImageSchema);
