import { HttpError } from "./attempts";
import { addCalendarDays, parseYmdKey, zonedMidnight } from "./dates";
import type { Viewer } from "./viewer";
import { Announcement, ANNOUNCEMENT_TONES } from "@/models/Announcement";
import { Settings } from "@/models/Settings";

export type AnnouncementJSON = {
  _id: string;
  message: string;
  linkUrl: string;
  linkLabel: string;
  tone: (typeof ANNOUNCEMENT_TONES)[number];
  startsAt: string;
  endsAt: string | null;
  state: "scheduled" | "live" | "ended";
  createdByName: string;
};

export function serializeAnnouncement(d: Record<string, unknown>, now = Date.now()): AnnouncementJSON {
  const starts = new Date(d.startsAt as Date);
  const ends = d.endsAt ? new Date(d.endsAt as Date) : null;
  return {
    _id: String(d._id),
    message: String(d.message ?? ""),
    linkUrl: String(d.linkUrl ?? ""),
    linkLabel: String(d.linkLabel ?? ""),
    tone: (d.tone as AnnouncementJSON["tone"]) ?? "info",
    startsAt: starts.toISOString(),
    endsAt: ends ? ends.toISOString() : null,
    state: starts.getTime() > now ? "scheduled" : ends && ends.getTime() <= now ? "ended" : "live",
    createdByName: String(d.createdByName ?? ""),
  };
}

const live = (now = new Date()) => ({ startsAt: { $lte: now }, $or: [{ endsAt: null }, { endsAt: { $gt: now } }] });

/** Live announcements the viewer hasn't dismissed, newest first. */
export async function activeFor(viewer: Viewer) {
  const doc = await Settings.findOne({ userId: viewer.id }, { dismissedAnnouncements: 1 }).lean();
  const dismissed = (doc?.dismissedAnnouncements ?? []).map(String);
  const items = await Announcement.find({ ...live(), _id: { $nin: dismissed } }).sort({ startsAt: -1 }).limit(5).lean();
  return items.map((d) => serializeAnnouncement(d as Record<string, unknown>));
}

export async function dismiss(viewer: Viewer, id: string) {
  await Settings.updateOne({ userId: viewer.id }, { $addToSet: { dismissedAnnouncements: id } }, { upsert: true });
}

/**
 * Cleans an announcement from the form. Dates are "YYYY-MM-DD" in the author's timezone: it starts at
 * the beginning of the start day and runs through the whole end day.
 */
export function announcementInput(body: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  if (!partial || body.message !== undefined) {
    const message = String(body.message ?? "").trim().replace(/\s+/g, " ");
    if (!message) throw new HttpError("Write a message.", 400);
    if (message.length > 280) throw new HttpError("Keep it under 280 characters.", 400);
    out.message = message;
  }
  if (!partial || body.linkUrl !== undefined) {
    const url = String(body.linkUrl ?? "").trim();
    if (url && !/^(https?:\/\/|\/(?!\/))/.test(url)) throw new HttpError("The link must start with https:// or / (a page in the app).", 400);
    out.linkUrl = url;
    out.linkLabel = url ? String(body.linkLabel ?? "").trim().slice(0, 40) : "";
  }
  if (!partial || body.tone !== undefined) {
    out.tone = ANNOUNCEMENT_TONES.find((t) => t === body.tone) ?? "info";
  }
  if (!partial || body.startDate !== undefined) {
    const ymd = body.startDate ? parseYmdKey(String(body.startDate)) : null;
    if (body.startDate && !ymd) throw new HttpError("Start date must be YYYY-MM-DD.", 400);
    out.startsAt = ymd ? zonedMidnight(ymd) : new Date();
  }
  if (!partial || body.endDate !== undefined) {
    const ymd = body.endDate ? parseYmdKey(String(body.endDate)) : null;
    if (body.endDate && !ymd) throw new HttpError("End date must be YYYY-MM-DD.", 400);
    out.endsAt = ymd ? zonedMidnight(addCalendarDays(ymd, 1)) : null;
  }
  if (out.startsAt && out.endsAt && (out.endsAt as Date) <= (out.startsAt as Date)) {
    throw new HttpError("The end date must be on or after the start date.", 400);
  }
  return out;
}
