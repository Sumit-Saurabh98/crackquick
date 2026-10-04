import { NextResponse } from "next/server";
import { dateKey } from "@/lib/dates";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { ActivityEvent } from "@/models/Event";
import { Question } from "@/models/Question";
import { Settings } from "@/models/Settings";

/** Full JSON backup of every collection. */
export async function GET() {
  try {
    await dbConnect();
    const [questions, events, settings] = await Promise.all([
      Question.find({}).lean(),
      ActivityEvent.find({}).lean(),
      Settings.findOne({ key: "main" }).lean(),
    ]);
    const body = JSON.stringify(
      { exportedAt: new Date().toISOString(), version: 3, questions, events, settings },
      null,
      2,
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="crackquick-${dateKey(new Date())}.json"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
