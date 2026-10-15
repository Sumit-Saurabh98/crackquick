import { Schema } from "mongoose";
import { defineModel } from "./model";

/**
 * A user's own rich-text note. `content` is the editor's document (TipTap JSON), `text` its plain text
 * for search and excerpts, `imageIds` the uploaded images it shows (so unused uploads can be cleaned up).
 */
const NoteSchema = new Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, default: null },
    content: { type: Schema.Types.Mixed, required: true },
    text: { type: String, default: "" },
    imageIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true, minimize: false },
);

NoteSchema.index({ userId: 1, updatedAt: -1 });
NoteSchema.index({ userId: 1, categoryId: 1 });

export const Note = defineModel("Note", NoteSchema);
