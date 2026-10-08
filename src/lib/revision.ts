import { DEFAULT_REVISION_INTERVALS } from "./constants";
import { addDays, startOfToday } from "./dates";

/** What the user reports. The stored event kind is derived from this. */
export type Outcome = "recalled" | "blanked";
export type AttemptKind = "solved" | "revised" | "failed_recall";
export type RevisionState = "overdue" | "due" | "upcoming" | "none";

/** Cleans a user-supplied ladder: positive whole days, ascending, 1–12 steps. */
export function normalizeIntervals(raw: unknown): number[] {
  const list = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,]+/))
    .map((n) => Math.round(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 3650);
  const unique = [...new Set(list)].sort((a, b) => a - b).slice(0, 12);
  return unique.length ? unique : DEFAULT_REVISION_INTERVALS;
}

export function attemptKind(outcome: Outcome, timesSolved: number): AttemptKind {
  if (outcome === "blanked") return "failed_recall";
  return timesSolved > 0 ? "revised" : "solved";
}

export function intervalFor(stage: number, intervals: number[]) {
  return intervals[Math.min(intervals.length - 1, Math.max(0, stage))];
}

/**
 * Step on the ladder after one attempt. Blank or confidence 1 → back to the first step;
 * 2 → one step down; 3 → same; 4–5 → one step up, unless reviewed early (before its due day).
 */
export function nextStage(opts: {
  stage: number;
  confidence: number;
  outcome: Outcome;
  early: boolean;
  intervals: number[];
}) {
  const { stage, confidence, outcome, early, intervals } = opts;
  const top = intervals.length - 1;
  const current = Math.min(top, Math.max(0, stage));
  if (outcome === "blanked" || confidence <= 1) return 0;
  if (confidence === 2) return Math.max(0, current - 1);
  if (confidence >= 4 && !early) return Math.min(top, current + 1);
  return current;
}

/** Due date = local midnight of (day of `from`) + interval. */
export function scheduleRevision(stage: number, intervals: number[], from = new Date()) {
  return addDays(startOfToday(from), intervalFor(stage, intervals));
}

/** Classifies a due date against today's date in the user's timezone. */
export function revisionState(nextRevisionAt: string | Date | null, now = new Date()): RevisionState {
  if (!nextRevisionAt) return "none";
  const due = new Date(nextRevisionAt).getTime();
  const today = startOfToday(now);
  if (due < today.getTime()) return "overdue";
  if (due < addDays(today, 1).getTime()) return "due";
  return "upcoming";
}
