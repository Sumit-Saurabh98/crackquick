import { NextResponse } from "next/server";
import { activeFor, announcementInput, serializeAnnouncement } from "@/lib/announcements";
import { requirePermission, route } from "@/lib/viewer";
import { Announcement } from "@/models/Announcement";

/**
 * Live announcements the viewer hasn't dismissed. With ?all=1 (needs announcements.manage):
 * every announcement, scheduled / live / ended, newest first.
 */
export const GET = route(async (req, { viewer }) => {
  if (req.nextUrl.searchParams.get("all") !== "1") return NextResponse.json({ items: await activeFor(viewer) });
  requirePermission(viewer, "announcements.manage");
  const docs = await Announcement.find({}).sort({ startsAt: -1 }).limit(100).lean();
  return NextResponse.json({ items: docs.map((d) => serializeAnnouncement(d as Record<string, unknown>)) });
});

/** Needs announcements.manage. Body: { message, linkUrl?, linkLabel?, tone?, startDate?, endDate? } */
export const POST = route(
  async (req, { viewer }) => {
    const doc = await Announcement.create({
      ...announcementInput(await req.json()),
      createdBy: viewer.id,
      createdByName: viewer.name || viewer.email,
    });
    return NextResponse.json({ item: serializeAnnouncement(doc.toObject()) }, { status: 201 });
  },
  { permission: "announcements.manage", errorStatus: 400 },
);
