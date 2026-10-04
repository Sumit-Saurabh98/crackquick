import {
  addCalendarDays,
  dateKey,
  daysBetweenYmd,
  mondayIndex,
  parseYmdKey,
  periodRange,
  previousPeriodRange,
  ymdKey,
  zonedMidnight,
  zonedYmd,
} from "./dates";
import { revisionState } from "./revision";
import { serializeQuestion, type QuestionJSON } from "./serialize";
import { ActivityEvent } from "@/models/Event";
import { Question } from "@/models/Question";
import { getSettings } from "@/models/Settings";

type Ev = {
  questionId: string;
  type: "solved" | "revised" | "failed_recall";
  at: Date;
  minutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  backfill: boolean;
};

/** A year of weeks; the heatmap shows as many of the most recent ones as fit the screen. */
const HEATMAP_WEEKS = 53;

function toEvent(d: Record<string, unknown>): Ev {
  return {
    questionId: String(d.questionId),
    type: d.type as Ev["type"],
    at: new Date(d.at as Date),
    minutes: Number(d.minutes ?? 0),
    difficulty: (d.difficulty as Ev["difficulty"]) || "Medium",
    backfill: Boolean(d.backfill),
  };
}

/** Per topic: how many are done, and how many of those are overdue. Least-complete first. */
function topicProgress(questions: QuestionJSON[], now: Date) {
  const map = new Map<string, { total: number; done: number; overdue: number }>();
  for (const q of questions) {
    for (const t of q.topics.length ? q.topics : ["Untagged"]) {
      const row = map.get(t) ?? { total: 0, done: 0, overdue: 0 };
      row.total += 1;
      if (q.status === "done") row.done += 1;
      if (revisionState(q.nextRevisionAt, now) === "overdue") row.overdue += 1;
      map.set(t, row);
    }
  }
  return [...map.entries()]
    .map(([topic, r]) => ({ topic, ...r, pct: r.total ? Math.round((r.done / r.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total || a.topic.localeCompare(b.topic));
}

function computeStreak(dayKeys: Set<string>, now: Date) {
  // Not practised yet today doesn't break the streak; it's still alive from yesterday.
  let cursor = zonedYmd(now);
  const activeToday = dayKeys.has(ymdKey(cursor));
  if (!activeToday) cursor = addCalendarDays(cursor, -1);
  let current = 0;
  while (dayKeys.has(ymdKey(cursor))) {
    current += 1;
    cursor = addCalendarDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of [...dayKeys].sort()) {
    const gap = prev ? daysBetweenYmd(parseYmdKey(prev)!, parseYmdKey(key)!) : 0;
    run = gap === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = key;
  }
  return { current, longest, activeToday };
}

function periodMetrics(events: Ev[], byId: Map<string, QuestionJSON>, range: { from: Date; to: Date }) {
  const inRange = events.filter((e) => e.at >= range.from && e.at < range.to);
  const solved = inRange.filter((e) => e.type === "solved");
  const mix = { Easy: 0, Medium: 0, Hard: 0 };
  for (const e of solved) mix[e.difficulty] += 1;

  const topics: Record<string, number> = {};
  for (const e of inRange) {
    for (const t of byId.get(e.questionId)?.topics ?? []) topics[t] = (topics[t] || 0) + 1;
  }

  return {
    newSolves: new Set(solved.map((e) => e.questionId)).size,
    revisions: inRange.filter((e) => e.type === "revised").length,
    blanks: inRange.filter((e) => e.type === "failed_recall").length,
    activeDays: new Set(inRange.filter((e) => !e.backfill).map((e) => dateKey(e.at))).size,
    minutes: inRange.reduce((s, e) => s + e.minutes, 0),
    mix,
    topics: Object.entries(topics)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function computeStats(period = "day") {
  const now = new Date();
  const [questionDocs, eventDocs, settings] = await Promise.all([
    Question.find({}).lean(),
    ActivityEvent.find({}).lean(),
    getSettings(),
  ]);
  const everything = questionDocs.map((d) => serializeQuestion(d as Record<string, unknown>));
  const byId = new Map(everything.map((q) => [q._id, q]));
  const questions = everything.filter((q) => !q.archived);
  const events = eventDocs.map((d) => toEvent(d as Record<string, unknown>));

  const state = new Map(questions.map((q) => [q._id, revisionState(q.nextRevisionAt, now)]));
  const overdue = questions
    .filter((q) => state.get(q._id) === "overdue")
    .sort((a, b) => +new Date(a.nextRevisionAt!) - +new Date(b.nextRevisionAt!));
  const dueToday = questions.filter((q) => state.get(q._id) === "due");

  // Streak and heatmap ignore backfilled solves: they are history, not today's effort.
  const live = events.filter((e) => !e.backfill);
  const streak = computeStreak(new Set(live.map((e) => dateKey(e.at))), now);

  const todayYmd = zonedYmd(now);
  const todayKey = ymdKey(todayYmd);
  const gridStart = addCalendarDays(todayYmd, -mondayIndex(todayYmd) - (HEATMAP_WEEKS - 1) * 7);
  const perDay: Record<string, number> = {};
  for (const e of live) {
    const k = dateKey(e.at);
    perDay[k] = (perDay[k] || 0) + 1;
  }
  const heatmap = Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => {
    const date = ymdKey(addCalendarDays(gridStart, i));
    return { date, count: perDay[date] || 0, future: date > todayKey };
  });

  let countdown: { date: string; daysLeft: number; remaining: number } | null = null;
  if (settings.interviewDate) {
    const target = new Date(settings.interviewDate);
    const daysLeft = Math.max(0, daysBetweenYmd(todayYmd, zonedYmd(target)));
    const remaining = questions.filter((q) => q.status !== "done").length;
    countdown = {
      date: zonedMidnight(zonedYmd(target)).toISOString(),
      daysLeft,
      remaining,
    };
  }

  const range = periodRange(period, now);
  const prevRange = previousPeriodRange(period, now);

  return {
    totals: {
      total: questions.length,
      done: questions.filter((q) => q.status === "done").length,
      inProgress: questions.filter((q) => q.status === "in_progress").length,
      todo: questions.filter((q) => q.status === "todo").length,
      overdue: overdue.length,
      dueToday: dueToday.length,
    },
    streak,
    topics: topicProgress(questions, now),
    heatmap,
    reviewQueue: [...overdue, ...dueToday].slice(0, 10),
    countdown,
    period: {
      name: period,
      from: range.from.toISOString(),
      current: periodMetrics(events, byId, range),
      previous: prevRange ? periodMetrics(events, byId, prevRange) : null,
    },
  };
}

export type Stats = Awaited<ReturnType<typeof computeStats>>;
