import { serializeAudit } from "./audit";
import { findDuplicates } from "./duplicates";
import { can, type Viewer } from "./viewer";
import { suspendedUserIds, userOverview } from "./users";
import { AuditEntry } from "@/models/AuditEntry";
import { ActivityEvent } from "@/models/Event";
import { Question } from "@/models/Question";
import { Submission } from "@/models/Submission";

const DAY = 86400000;

/** Numbers for the admin dashboard. Sections the viewer can't act on are left out. */
export async function adminOverview(viewer: Viewer) {
  const now = Date.now();
  const week = new Date(now - 7 * DAY);
  const month = new Date(now - 30 * DAY);
  const pendingFilter = { status: "pending", userId: { $nin: await suspendedUserIds() } };
  const [live, retired, addedWeek, retiredMonth, attemptsWeek, pending, oldestPending, changes, people] = await Promise.all([
    Question.countDocuments({ retired: { $ne: true } }),
    Question.countDocuments({ retired: true }),
    Question.countDocuments({ createdAt: { $gte: week } }),
    AuditEntry.countDocuments({ action: "retire", at: { $gte: month } }),
    ActivityEvent.countDocuments({ at: { $gte: week }, backfill: { $ne: true } }),
    Submission.countDocuments(pendingFilter),
    Submission.findOne(pendingFilter).sort({ createdAt: 1 }).lean(),
    can(viewer, "catalog.edit") ? AuditEntry.find({}).sort({ at: -1, _id: -1 }).limit(8).lean() : Promise.resolve([]),
    can(viewer, "users.manage") ? userOverview(week) : Promise.resolve(null),
  ]);
  const duplicates = can(viewer, "catalog.edit") ? (await findDuplicates()).length : null;
  return {
    catalog: { live, retired, addedWeek, retiredMonth, attemptsWeek, duplicates },
    submissions: can(viewer, "submissions.review")
      ? { pending, oldestAt: oldestPending?.createdAt ? new Date(oldestPending.createdAt).toISOString() : null }
      : null,
    users: people,
    recentChanges: changes.map((d) => serializeAudit(d as Record<string, unknown>)),
  };
}

export type OverviewJSON = Awaited<ReturnType<typeof adminOverview>>;
