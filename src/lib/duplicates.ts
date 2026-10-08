import mongoose from "mongoose";
import { HttpError } from "./attempts";
import { audit, auditEntry, snapshot } from "./audit";
import { canonicalProblemUrl } from "./problemUrl";
import { videoLinks } from "./serialize";
import type { Viewer } from "./viewer";
import { DuplicateDismissal } from "@/models/DuplicateDismissal";
import { ActivityEvent } from "@/models/Event";
import { Progress } from "@/models/Progress";
import { Question } from "@/models/Question";
import { Submission } from "@/models/Submission";

const STOP = new Set(["a", "an", "the", "of", "in", "to", "and", "for", "with", "on", "at", "by", "from", "is", "into", "or"]);
/** Variant markers: "House Robber" and "House Robber II" are different problems. */
const VARIANT = /^(i{1,3}|iv|v|vi{0,3}|ix|x|\d+)$/;

export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^\s*\d+\s*[.)-]\s*/, "") // "146. LRU Cache"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const words = (norm: string) => norm.split(" ").filter((w) => w && !STOP.has(w));

function levenshtein(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

type Doc = { _id: mongoose.Types.ObjectId; title: string; platform: string; platformUrl: string; externalId: string; difficulty: string; videoUrls?: string[]; videoUrl?: string; companies?: string[] };

/** A one-letter slip ("elemnt" / "element") in a word long enough for that to be a typo, not a different word. */
const typo = (a: string, b: string) => Math.min(a.length, b.length) >= 5 && levenshtein(a, b) <= 1;

/**
 * Whether two titles name the same problem, and why; null when they don't. Strict on purpose:
 * words are compared in order, and each word that differs must be a typo of the word in the same
 * place, so "Directed" vs "Undirected", "Queue using Stacks" vs "Stack using Queues" or
 * "… with Cooldown" are different problems.
 */
function compare(a: { norm: string; words: string[] }, b: { norm: string; words: string[] }) {
  if (a.norm === b.norm) return { score: 1, reason: "Same title" };
  if (!a.words.length || a.words.join("") !== b.words.join("")) {
    if (a.words.length !== b.words.length) return null;
    const diff = a.words.map((w, i) => [w, b.words[i]] as const).filter(([x, y]) => x !== y);
    if (!diff.length || diff.length > 2) return null;
    const ok = diff.every(([x, y]) => !VARIANT.test(x) && !VARIANT.test(y) && typo(x, y));
    return ok ? { score: 0.9, reason: "Same title apart from a typo" } : null;
  }
  return { score: 0.98, reason: "Same title, different spacing" };
}

export type DuplicatePair = {
  score: number;
  reason: string;
  a: QuestionCard;
  b: QuestionCard;
};

type QuestionCard = {
  _id: string;
  title: string;
  platform: string;
  externalId: string;
  platformUrl: string;
  difficulty: string;
  videos: number;
  companies: number;
  learners: number;
  attempts: number;
};

/** Likely duplicate pairs among live catalog questions, best match first, minus dismissed pairs. */
export async function findDuplicates(limit = 200): Promise<DuplicatePair[]> {
  const docs = (await Question.find({ retired: { $ne: true } }, { title: 1, platform: 1, platformUrl: 1, externalId: 1, difficulty: 1, videoUrls: 1, videoUrl: 1, companies: 1 }).lean()) as Doc[];
  const items = docs.map((d) => {
    const norm = normalizeTitle(String(d.title));
    return { d, norm, words: words(norm), url: d.platformUrl ? canonicalProblemUrl(d.platformUrl).toLowerCase() : "" };
  });

  // Candidates share a reasonably rare word (or a link), so this isn't every pair against every pair.
  const index = new Map<string, number[]>();
  items.forEach((it, i) => new Set(it.words).forEach((w) => index.set(w, [...(index.get(w) ?? []), i])));
  const common = Math.max(50, Math.ceil(items.length * 0.1));
  const found = new Map<string, { i: number; j: number; score: number; reason: string }>();
  const consider = (i: number, j: number) => {
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (i === j || found.has(key)) return;
    if (items[i].url && items[i].url === items[j].url) {
      found.set(key, { i, j, score: 1, reason: "Same problem link" });
      return;
    }
    const r = compare(items[i], items[j]);
    if (r) found.set(key, { i, j, ...r });
  };
  for (const list of index.values()) {
    if (list.length > common) continue;
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) consider(list[x], list[y]);
  }
  const byUrl = new Map<string, number>();
  items.forEach((it, i) => {
    if (!it.url) return;
    if (byUrl.has(it.url)) consider(byUrl.get(it.url)!, i);
    else byUrl.set(it.url, i);
  });

  const dismissed = new Set((await DuplicateDismissal.find({}, { a: 1, b: 1 }).lean()).map((p) => `${p.a}:${p.b}`));
  const pairs = [...found.values()]
    .map((p) => {
      const [x, y] = [items[p.i].d, items[p.j].d].sort((m, n) => String(m._id).localeCompare(String(n._id)));
      return { ...p, x, y };
    })
    .filter((p) => !dismissed.has(`${p.x._id}:${p.y._id}`))
    .sort((m, n) => n.score - m.score)
    .slice(0, limit);

  const ids = [...new Set(pairs.flatMap((p) => [p.x._id, p.y._id]))];
  const [learners, attempts] = await Promise.all([
    Progress.aggregate<{ _id: unknown; n: number }>([{ $match: { questionId: { $in: ids } } }, { $group: { _id: "$questionId", n: { $sum: 1 } } }]),
    ActivityEvent.aggregate<{ _id: unknown; n: number }>([{ $match: { questionId: { $in: ids } } }, { $group: { _id: "$questionId", n: { $sum: 1 } } }]),
  ]);
  const count = (rows: { _id: unknown; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [nLearners, nAttempts] = [count(learners), count(attempts)];
  const card = (d: Doc): QuestionCard => ({
    _id: String(d._id),
    title: String(d.title),
    platform: String(d.platform ?? ""),
    externalId: String(d.externalId ?? ""),
    platformUrl: String(d.platformUrl ?? ""),
    difficulty: String(d.difficulty ?? ""),
    videos: videoLinks(d as unknown as Record<string, unknown>).length,
    companies: d.companies?.length ?? 0,
    learners: nLearners.get(String(d._id)) ?? 0,
    attempts: nAttempts.get(String(d._id)) ?? 0,
  });
  return pairs.map((p) => ({ score: Math.round(p.score * 100) / 100, reason: p.reason, a: card(p.x), b: card(p.y) }));
}

export async function dismissPair(viewer: Viewer, a: string, b: string) {
  if (!mongoose.isValidObjectId(a) || !mongoose.isValidObjectId(b) || a === b) throw new HttpError("Pick two questions.", 400);
  const [x, y] = [a, b].sort();
  await DuplicateDismissal.updateOne({ a: x, b: y }, { $setOnInsert: { a: x, b: y, userId: viewer.id } }, { upsert: true });
}

const RANK = { todo: 0, in_progress: 1, done: 2 } as const;
const SCHEDULE = ["lastSolvedAt", "nextRevisionAt", "revisionStage", "confidence", "timeSpentMinutes"] as const;
const union = (a: string[], b: string[]) => [...new Map([...a, ...b].map((x) => [x.toLowerCase(), x])).values()];

/**
 * Merges `dropId` into `keepId`: everyone's progress and attempts move to the kept question (a user
 * with progress on both gets one combined record), its videos / topics / companies are added to the
 * kept one, pending edit suggestions on it are closed, and it's retired, all in the audit log.
 */
export async function mergeQuestions(viewer: Viewer, keepId: string, dropId: string) {
  if (keepId === dropId) throw new HttpError("Pick two different questions.", 400);
  const [keep, drop] = await Promise.all([Question.findById(keepId), Question.findById(dropId)]);
  if (!keep || !drop) throw new HttpError("Question not found", 404);
  if (keep.retired) throw new HttpError("The question to keep is retired. Restore it first.", 409);

  let moved = 0;
  let combined = 0;
  for (const p of await Progress.find({ questionId: drop._id })) {
    const k = await Progress.findOne({ userId: p.userId, questionId: keep._id });
    if (!k) {
      p.questionId = keep._id;
      await p.save();
      moved++;
      continue;
    }
    // The more recently solved record's schedule wins; counts add up; notes are kept from both.
    const newer = (p.lastSolvedAt?.getTime() ?? 0) > (k.lastSolvedAt?.getTime() ?? 0);
    if (newer) for (const f of SCHEDULE) k.set(f, p.get(f));
    k.status = RANK[p.status] > RANK[k.status] ? p.status : k.status;
    k.timesSolved = (k.timesSolved ?? 0) + (p.timesSolved ?? 0);
    k.lapses = (k.lapses ?? 0) + (p.lapses ?? 0);
    k.totalMinutes = (k.totalMinutes ?? 0) + (p.totalMinutes ?? 0);
    k.notes = [k.notes, p.notes].filter((n) => n?.trim()).join("\n\n---\n\n");
    k.isStarred = k.isStarred || p.isStarred;
    k.archived = k.archived && p.archived;
    await k.save();
    await p.deleteOne();
    combined++;
  }
  const { modifiedCount: attempts } = await ActivityEvent.updateMany({ questionId: drop._id }, { $set: { questionId: keep._id } });
  await Submission.updateMany(
    { questionId: drop._id, status: "pending" },
    { $set: { status: "rejected", reviewNote: `Merged into “${keep.title}”.`, reviewedAt: new Date(), reviewedBy: viewer.id } },
  );

  const keepBefore = snapshot(keep.toObject());
  keep.videoUrls = union(videoLinks(keep.toObject()), videoLinks(drop.toObject()));
  keep.videoUrl = undefined;
  keep.topics = union(keep.topics, drop.topics);
  keep.companies = union(keep.companies, drop.companies);
  if (!keep.pattern && drop.pattern) keep.pattern = drop.pattern;
  await keep.save();

  const dropBefore = snapshot(drop.toObject());
  drop.retired = true;
  drop.mergedInto = keep._id;
  await drop.save();

  await audit(
    auditEntry(viewer, keep, keepBefore, snapshot(keep.toObject()), { source: "merge" }),
    auditEntry(viewer, drop, dropBefore, snapshot(drop.toObject()), { source: "merge" }),
  );
  return { moved, combined, attempts };
}
