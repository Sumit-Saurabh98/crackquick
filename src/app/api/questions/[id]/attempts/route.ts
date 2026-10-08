import { NextResponse } from "next/server";
import { logAttempt, parseAttemptInput } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { serializeAttempt } from "@/lib/serialize";
import { route } from "@/lib/viewer";
import { ActivityEvent } from "@/models/Event";

type P = { id: string };

/** The viewer's own attempts on this question, newest first. */
export const GET = route<P>(async (_req, { viewer, params }) => {
  const questionId = checkId(params.id, "Question not found");
  const docs = await ActivityEvent.find({ userId: viewer.id, questionId }).sort({ at: -1, _id: -1 }).lean();
  return NextResponse.json({ items: docs.map((d) => serializeAttempt(d as Record<string, unknown>)) });
});

/** Body: { outcome: "recalled" | "blanked", confidence 1-5, minutes?, solvedAt? } */
export const POST = route<P>(
  async (req, { viewer, params }) => {
    checkId(params.id, "Question not found");
    const input = parseAttemptInput(await req.json());
    return NextResponse.json(await logAttempt(viewer.id, viewer.settings.intervals, params.id, input));
  },
  { errorStatus: 400 },
);
