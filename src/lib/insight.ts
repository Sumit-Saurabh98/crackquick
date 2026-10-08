import mongoose from "mongoose";
import { countLearners } from "./users";
import { ActivityEvent } from "@/models/Event";
import { Progress } from "@/models/Progress";

/** How everyone is doing on one question, as totals only (no individual's data). */
export async function questionInsight(questionId: string, difficulty: string, hasVideo: boolean) {
  const qid = new mongoose.Types.ObjectId(questionId);
  const [learners, statuses, flags, attempts] = await Promise.all([
    countLearners(),
    Progress.aggregate<{ _id: string; n: number }>([{ $match: { questionId: qid } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Progress.aggregate<{ hidden: number; starred: number }>([
      { $match: { questionId: qid } },
      {
        $group: {
          _id: null,
          hidden: { $sum: { $cond: ["$archived", 1, 0] } },
          starred: { $sum: { $cond: ["$isStarred", 1, 0] } },
        },
      },
    ]),
    ActivityEvent.aggregate<{ total: number; blanks: number; confSum: number; confN: number; minSum: number; minN: number; users: string[] }>([
      { $match: { questionId: qid } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          blanks: { $sum: { $cond: [{ $eq: ["$type", "failed_recall"] }, 1, 0] } },
          confSum: { $sum: { $cond: [{ $ne: ["$type", "failed_recall"] }, "$confidence", 0] } },
          confN: { $sum: { $cond: [{ $ne: ["$type", "failed_recall"] }, 1, 0] } },
          minSum: { $sum: { $cond: [{ $gt: ["$minutes", 0] }, "$minutes", 0] } },
          minN: { $sum: { $cond: [{ $gt: ["$minutes", 0] }, 1, 0] } },
          users: { $addToSet: "$userId" },
        },
      },
    ]),
  ]);
  const count = (s: string) => statuses.find((x) => x._id === s)?.n ?? 0;
  const done = count("done");
  const inProgress = count("in_progress");
  const a = attempts[0];
  const total = a?.total ?? 0;
  const blankRate = total ? a!.blanks / total : 0;
  const avgConfidence = a?.confN ? a.confSum / a.confN : null;
  const avgMinutes = a?.minN ? a.minSum / a.minN : null;
  const hidden = flags[0]?.hidden ?? 0;

  // Hints for the catalog editor, only once there's enough data to mean something.
  const notes: string[] = [];
  if (total >= 5 && blankRate >= 0.4) {
    notes.push(
      `Blanked in ${Math.round(blankRate * 100)}% of attempts.${hasVideo ? " Check the video explains the trick." : " Adding a video could help."}`,
    );
  }
  if (a && a.confN >= 5 && avgConfidence !== null) {
    if (difficulty === "Easy" && avgConfidence < 3) notes.push("Marked Easy, but people find it hard. Check the difficulty.");
    else if (avgConfidence < 2.5) notes.push("Low average confidence: people rarely get this cleanly.");
    else if (difficulty === "Hard" && avgConfidence >= 4.3) notes.push("Marked Hard, but people find it easy. Check the difficulty.");
  }
  if (hidden >= 3) notes.push(`Hidden by ${hidden} people: it may be off-topic, premium-only or a duplicate.`);

  return {
    learners,
    done,
    inProgress,
    notStarted: Math.max(0, learners - done - inProgress),
    hidden,
    starred: flags[0]?.starred ?? 0,
    attempts: total,
    people: a?.users.length ?? 0,
    blankRate,
    avgConfidence,
    avgMinutes,
    notes,
  };
}

export type InsightJSON = Awaited<ReturnType<typeof questionInsight>>;
