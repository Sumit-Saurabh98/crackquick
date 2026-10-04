import { parseYmdKey, zonedMidnight } from "./dates";
import { attemptKind, nextStage, revisionState, scheduleRevision, type Outcome } from "./revision";
import { serializeQuestion } from "./serialize";
import { ActivityEvent } from "@/models/Event";
import { Question } from "@/models/Question";
import { getSettings } from "@/models/Settings";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type AttemptInput = {
  outcome: Outcome;
  confidence: number;
  minutes: number;
  /** Past date for a solve done before using the app. Only allowed on a never-attempted question. */
  solvedAt?: Date;
};

/** "YYYY-MM-DD" → noon that day in the user's timezone; full ISO strings are accepted as-is. */
function parseSolvedAt(raw: unknown) {
  const s = String(raw);
  const ymd = parseYmdKey(s);
  const d = ymd ? zonedMidnight(ymd, 12) : new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError("Invalid solvedAt date.", 400);
  if (d.getTime() > Date.now()) throw new HttpError("solvedAt cannot be in the future.", 400);
  return d;
}

export function parseAttemptInput(body: Record<string, unknown>): AttemptInput {
  const outcome: Outcome = body.outcome === "blanked" ? "blanked" : "recalled";
  const rawConfidence = Number(body.confidence);
  if (outcome === "recalled" && !(rawConfidence >= 1 && rawConfidence <= 5)) {
    throw new HttpError("Confidence 1-5 is required.", 400);
  }
  return {
    outcome,
    confidence: outcome === "blanked" ? 1 : Math.round(rawConfidence),
    minutes: Math.max(0, Math.round(Number(body.minutes) || 0)),
    solvedAt: body.solvedAt ? parseSolvedAt(body.solvedAt) : undefined,
  };
}

const SNAPSHOT_KEYS = [
  "status",
  "timesSolved",
  "lapses",
  "lastSolvedAt",
  "nextRevisionAt",
  "revisionStage",
  "confidence",
  "timeSpentMinutes",
  "totalMinutes",
] as const;

export async function logAttempt(id: string, input: AttemptInput) {
  const q = await Question.findById(id);
  if (!q) throw new HttpError("Question not found", 404);

  const backfill = Boolean(input.solvedAt);
  if (backfill) {
    const hasHistory = await ActivityEvent.exists({ questionId: q._id });
    if (hasHistory || q.timesSolved > 0) {
      throw new HttpError("A past solve can only be logged on a question with no history.", 400);
    }
  }

  const { intervals } = await getSettings();
  const at = input.solvedAt ?? new Date();
  const state = revisionState(q.nextRevisionAt, at);
  const kind = attemptKind(input.outcome, q.timesSolved ?? 0);
  const prev = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, q.get(k)]));

  const stage = nextStage({
    stage: q.revisionStage ?? 0,
    confidence: input.confidence,
    outcome: input.outcome,
    early: q.status === "done" && state === "upcoming",
    intervals,
  });
  q.revisionStage = stage;
  q.nextRevisionAt = scheduleRevision(stage, intervals, at);
  q.confidence = input.confidence;
  q.timeSpentMinutes = input.minutes;
  q.totalMinutes = (q.totalMinutes ?? 0) + input.minutes;
  if (input.outcome === "blanked") {
    q.status = "in_progress";
    q.lapses = (q.lapses ?? 0) + 1;
  } else {
    q.status = "done";
    q.timesSolved = (q.timesSolved ?? 0) + 1;
    q.lastSolvedAt = at;
  }
  await q.save();

  await ActivityEvent.create({
    questionId: q._id,
    type: kind,
    at,
    confidence: input.confidence,
    minutes: input.minutes,
    onTime: state !== "overdue",
    difficulty: q.difficulty,
    backfill,
    prev,
  });

  return { item: serializeQuestion(q.toObject()), kind };
}

/** Removes the most recently logged attempt and restores the schedule it replaced. */
export async function undoLastAttempt(id: string) {
  const q = await Question.findById(id);
  if (!q) throw new HttpError("Question not found", 404);
  const last = await ActivityEvent.findOne({ questionId: q._id }).sort({ _id: -1 });
  if (!last) throw new HttpError("Nothing to undo.", 400);
  if (!last.prev) throw new HttpError("This attempt predates undo support.", 400);

  for (const k of SNAPSHOT_KEYS) {
    const v = last.prev[k];
    q.set(k, v === undefined ? null : v);
  }
  await q.save();
  await last.deleteOne();
  return { item: serializeQuestion(q.toObject()) };
}
