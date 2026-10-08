import { NextResponse } from "next/server";
import { dismiss } from "@/lib/announcements";
import { checkId } from "@/lib/http";
import { route } from "@/lib/viewer";

/** Hides this announcement for the viewer, on every device. */
export const POST = route<{ id: string }>(async (_req, { viewer, params }) => {
  await dismiss(viewer, checkId(params.id, "Announcement not found"));
  return NextResponse.json({ ok: true });
});
