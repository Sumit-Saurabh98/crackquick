import { NextResponse } from "next/server";
import { dateKey } from "@/lib/dates";
import { serializeAttempt, serializeQuestion } from "@/lib/serialize";
import { route } from "@/lib/viewer";
import { ActivityEvent } from "@/models/Event";
import { Progress } from "@/models/Progress";
import { Question } from "@/models/Question";

/**
 * The viewer's backup: every catalog question with their own progress and notes, their attempts and
 * settings. Its `questions` can be imported again (with catalog.edit) as catalog entries.
 */
export const GET = route(async (_req, { viewer }) => {
  const [questions, progress, events] = await Promise.all([
    Question.find({}).lean(),
    Progress.find({ userId: viewer.id }).lean(),
    ActivityEvent.find({ userId: viewer.id }).sort({ at: 1 }).lean(),
  ]);
  const mine = new Map(progress.map((p) => [String(p.questionId), p as Record<string, unknown>]));
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 4,
      user: { name: viewer.name, email: viewer.email },
      questions: questions.map((q) => serializeQuestion(q as Record<string, unknown>, mine.get(String(q._id)) ?? null)),
      events: events.map((e) => serializeAttempt(e as Record<string, unknown>)),
      settings: viewer.settings,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="crackquick-${dateKey(new Date())}.json"`,
    },
  });
});
