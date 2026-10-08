import { dateKey } from "./dates";
import { FeaturedDay } from "@/models/FeaturedDay";
import { Question } from "@/models/Question";

/** Picks a live question not yet featured this cycle; starts a new cycle once all have been. */
async function pick(): Promise<{ questionId: unknown; cycle: number } | null> {
  const latest = await FeaturedDay.findOne({}, { cycle: 1 }).sort({ cycle: -1 }).lean();
  let cycle = latest?.cycle ?? 1;
  const used = await FeaturedDay.distinct("questionId", { cycle });
  let pool = await Question.find({ retired: { $ne: true }, _id: { $nin: used } }, { _id: 1 }).lean();
  if (!pool.length) {
    cycle += 1;
    pool = await Question.find({ retired: { $ne: true } }, { _id: 1 }).lean();
  }
  if (!pool.length) return null;
  return { questionId: pool[Math.floor(Math.random() * pool.length)]._id, cycle };
}

/**
 * Today's question (in the caller's timezone), chosen the first time anyone asks for that date and
 * the same for everyone after. A question retired since it was picked is replaced.
 */
export async function questionOfTheDay(date = dateKey()) {
  let day = await FeaturedDay.findOne({ date }).lean();
  if (day && !(await Question.exists({ _id: day.questionId, retired: { $ne: true } }))) {
    await FeaturedDay.deleteOne({ _id: day._id });
    day = null;
  }
  if (!day) {
    const choice = await pick();
    if (!choice) return null;
    try {
      await FeaturedDay.create({ date, ...choice });
    } catch (e) {
      // Someone else picked today's at the same moment; theirs stands.
      if ((e as { code?: number }).code !== 11000) throw e;
    }
    day = await FeaturedDay.findOne({ date }).lean();
    if (!day) return null;
  }
  const [covered, total] = await Promise.all([
    FeaturedDay.countDocuments({ cycle: day.cycle }),
    Question.countDocuments({ retired: { $ne: true } }),
  ]);
  return { date, questionId: String(day.questionId), cycle: day.cycle, covered: Math.min(covered, total), total };
}
