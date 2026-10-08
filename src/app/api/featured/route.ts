import { NextResponse } from "next/server";
import { questionOfTheDay } from "@/lib/featured";
import { serializeQuestion } from "@/lib/serialize";
import { route } from "@/lib/viewer";
import { Progress } from "@/models/Progress";
import { Question } from "@/models/Question";

/** Today's question for everyone, with the viewer's own progress on it; `item` null if the catalog is empty. */
export const GET = route(async (_req, { viewer }) => {
  const day = await questionOfTheDay();
  if (!day) return NextResponse.json({ item: null });
  const [q, p] = await Promise.all([
    Question.findById(day.questionId).lean(),
    Progress.findOne({ userId: viewer.id, questionId: day.questionId }).lean(),
  ]);
  return NextResponse.json({ ...day, item: q ? serializeQuestion(q as Record<string, unknown>, p) : null });
});
