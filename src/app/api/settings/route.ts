import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { isValidTimezone, parseYmdKey, zonedMidnight } from "@/lib/dates";
import { runWithTimezone } from "@/lib/requestContext";
import { normalizeIntervals } from "@/lib/revision";
import { route } from "@/lib/viewer";
import { getSettings, Settings, type SettingsDoc } from "@/models/Settings";

function shape(s: SettingsDoc) {
  return {
    interviewDate: s.interviewDate ? new Date(s.interviewDate).toISOString() : null,
    intervals: s.intervals,
    timezone: s.timezone,
    playlists: s.playlists,
  };
}

export type SettingsJSON = ReturnType<typeof shape>;

export const GET = route(async (_req, { viewer }) => NextResponse.json(shape(viewer.settings)));

/** Body: any of { interviewDate: "YYYY-MM-DD" | null, intervals: number[] | "1, 3, 7", timezone }. Playlists have their own API (/api/playlists). */
export const PUT = route(
  async (req, { viewer }) => {
    const body = await req.json();
    const update: Record<string, unknown> = {};
    let timezone = viewer.settings.timezone;
    if (body.timezone !== undefined) {
      if (!isValidTimezone(String(body.timezone))) throw new HttpError("Unknown timezone.", 400);
      timezone = update.timezone = String(body.timezone);
    }
    if (body.interviewDate !== undefined) {
      if (!body.interviewDate) update.interviewDate = null;
      else {
        const ymd = parseYmdKey(String(body.interviewDate));
        if (!ymd) throw new HttpError("Interview date must be YYYY-MM-DD.", 400);
        // Read in the new timezone if this request changes it.
        update.interviewDate = runWithTimezone(timezone, () => zonedMidnight(ymd));
      }
    }
    if (body.intervals !== undefined) update.intervals = normalizeIntervals(body.intervals);
    await Settings.updateOne({ userId: viewer.id }, { $set: update }, { upsert: true });
    return NextResponse.json(shape(await getSettings(viewer.id)));
  },
  { errorStatus: 400 },
);
