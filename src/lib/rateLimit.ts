import { HttpError } from "./attempts";
import { RateWindow } from "@/models/RateWindow";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KEEP = 7 * DAY;

/** Per-user caps on actions that cost something (outbound requests) or invite spam. */
export const LIMITS = {
  lookup: { max: 30, windowMs: HOUR, label: "LeetCode / GFG lookups", per: "hour" },
  suggest: { max: 20, windowMs: DAY, label: "suggestions", per: "day" },
} as const;

export type LimitKind = keyof typeof LIMITS;

/** Pending edit suggestions one user may have at a time (new questions: one, see submissions.ts). */
export const MAX_PENDING_EDITS = 5;

function minutesLeft(windowStart: number, windowMs: number) {
  return Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 60_000));
}

/** Counts one request; throws 429 once the user is over the limit for the current window. */
export async function consume(userId: string, kind: LimitKind) {
  const { max, windowMs, label, per } = LIMITS[kind];
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  const key = { userId, kind, windowStart: new Date(start) };
  const bump = () =>
    RateWindow.findOneAndUpdate(
      key,
      { $inc: { count: 1 }, $set: { limit: max }, $setOnInsert: { expiresAt: new Date(start + windowMs + KEEP) } },
      { upsert: true, returnDocument: "after" },
    );
  // Two first requests at once can both try to create the window; the loser retries as an update.
  const doc = await bump().catch((e) => ((e as { code?: number }).code === 11000 ? bump() : Promise.reject(e)));
  if (doc && doc.count > max) {
    await RateWindow.updateOne(key, { $inc: { blocked: 1 } });
    const wait = minutesLeft(start, windowMs);
    throw new HttpError(`Too many ${label}: the limit is ${max} per ${per}. Try again in ${wait} min.`, 429);
  }
}

/** Last 7 days per user and kind: requests, refusals, busiest window, and use of the current window. */
export async function limitUsage() {
  const since = new Date(Date.now() - KEEP);
  const rows = await RateWindow.aggregate<{
    _id: { userId: string; kind: LimitKind };
    requests: number;
    blocked: number;
    peak: number;
    last: Date;
  }>([
    { $match: { windowStart: { $gte: since } } },
    {
      $group: {
        _id: { userId: "$userId", kind: "$kind" },
        requests: { $sum: "$count" },
        blocked: { $sum: "$blocked" },
        peak: { $max: "$count" },
        last: { $max: "$windowStart" },
      },
    },
    { $sort: { blocked: -1, requests: -1 } },
    { $limit: 100 },
  ]);
  return rows.map((r) => {
    const conf = LIMITS[r._id.kind];
    const currentStart = Math.floor(Date.now() / (conf?.windowMs ?? HOUR)) * (conf?.windowMs ?? HOUR);
    return {
      userId: r._id.userId,
      kind: r._id.kind,
      requests: r.requests,
      blocked: r.blocked,
      peak: r.peak,
      inCurrentWindow: new Date(r.last).getTime() === currentStart,
    };
  });
}
