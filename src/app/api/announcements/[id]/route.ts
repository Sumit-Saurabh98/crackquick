import { NextResponse } from "next/server";
import { announcementInput, serializeAnnouncement } from "@/lib/announcements";
import { HttpError } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { route } from "@/lib/viewer";
import { Announcement } from "@/models/Announcement";

type P = { id: string };

/** Needs announcements.manage. Any form field to change, or { endNow: true } to take it down now. */
export const PATCH = route<P>(
  async (req, { params }) => {
    const body = await req.json();
    const doc = await Announcement.findById(checkId(params.id, "Announcement not found"));
    if (!doc) throw new HttpError("Announcement not found", 404);
    if (body.endNow) doc.endsAt = new Date();
    else doc.set(announcementInput(body, true));
    if (doc.endsAt && doc.endsAt <= doc.startsAt && !body.endNow) throw new HttpError("The end date must be on or after the start date.", 400);
    await doc.save();
    return NextResponse.json({ item: serializeAnnouncement(doc.toObject()) });
  },
  { permission: "announcements.manage", errorStatus: 400 },
);

/** Needs announcements.manage. */
export const DELETE = route<P>(
  async (_req, { params }) => {
    await Announcement.deleteOne({ _id: checkId(params.id, "Announcement not found") });
    return NextResponse.json({ ok: true });
  },
  { permission: "announcements.manage" },
);
