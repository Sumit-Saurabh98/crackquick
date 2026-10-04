import { NextRequest, NextResponse } from "next/server";
import { isValidTimezone, parseYmdKey, setTimezone, zonedMidnight } from "@/lib/dates";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { normalizeIntervals } from "@/lib/revision";
import { getSettings, Settings, type SettingsDoc } from "@/models/Settings";

function shape(s: SettingsDoc) {
  return {
    interviewDate: s.interviewDate ? new Date(s.interviewDate).toISOString() : null,
    targetList: s.targetList,
    intervals: s.intervals,
    timezone: s.timezone,
  };
}

export type SettingsJSON = ReturnType<typeof shape>;

export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json(shape(await getSettings()));
  } catch (e) {
    return fail(e);
  }
}

/** Body: any of { interviewDate: "YYYY-MM-DD" | null, targetList, intervals: number[] | "1, 3, 7", timezone }. */
export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const update: Record<string, unknown> = {};
    // Apply a new timezone first so the interview date below is read in it.
    if (body.timezone !== undefined) {
      if (!isValidTimezone(String(body.timezone))) return fail(new Error("Unknown timezone."), 400);
      update.timezone = String(body.timezone);
      setTimezone(update.timezone as string);
    }
    if (body.interviewDate !== undefined) {
      if (!body.interviewDate) update.interviewDate = null;
      else {
        const ymd = parseYmdKey(String(body.interviewDate));
        if (!ymd) return fail(new Error("Interview date must be YYYY-MM-DD."), 400);
        update.interviewDate = zonedMidnight(ymd);
      }
    }
    if (body.targetList !== undefined) update.targetList = String(body.targetList);
    if (body.intervals !== undefined) update.intervals = normalizeIntervals(body.intervals);
    await Settings.updateOne({ key: "main" }, { $set: update, $unset: { dailyNewGoal: "" } }, { upsert: true });
    return NextResponse.json(shape(await getSettings()));
  } catch (e) {
    return fail(e, 400);
  }
}
