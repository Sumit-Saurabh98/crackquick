import { Schema } from "mongoose";
import { defineModel } from "./model";

export const ANNOUNCEMENT_TONES = ["info", "new", "warning"] as const;

/** A banner on everyone's Desk between `startsAt` and `endsAt` (open-ended when null). */
const AnnouncementSchema = new Schema(
  {
    message: { type: String, required: true, trim: true },
    linkUrl: { type: String, default: "" },
    linkLabel: { type: String, default: "" },
    tone: { type: String, enum: ANNOUNCEMENT_TONES, default: "info" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ startsAt: 1, endsAt: 1 });

export const Announcement = defineModel("Announcement", AnnouncementSchema);
