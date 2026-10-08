import type { PipelineStage } from "mongoose";
import { PAGE_SIZE } from "./constants";
import { addDays, startOfToday } from "./dates";
import { listOptions } from "./options";
import { serializeQuestion } from "./serialize";
import { can, type Viewer } from "./viewer";
import { PROGRESS_DEFAULTS } from "@/models/Progress";
import { Question } from "@/models/Question";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Stages that give each catalog question the user's own progress fields (defaults when they
 * haven't touched it), so the filters and sorts below work on one merged row.
 */
export function withProgress(userId: string): PipelineStage[] {
  return [
    {
      $lookup: {
        from: "progress",
        localField: "_id",
        foreignField: "questionId",
        pipeline: [{ $match: { userId } }],
        as: "_p",
      },
    },
    { $set: { _p: { $first: "$_p" } } },
    {
      $set: Object.fromEntries(
        Object.entries(PROGRESS_DEFAULTS).map(([k, v]) => [k, { $ifNull: [`$_p.${k}`, v] }]),
      ),
    },
    { $unset: "_p" },
  ];
}

/** Filter on merged rows (see `withProgress`). Retired questions are listed only for catalog editors asking for them. */
export function buildQuestionFilter(search: URLSearchParams, viewer: Viewer): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const get = (k: string) => search.get(k) || "";

  filter.retired = can(viewer, "catalog.edit") && get("retired") === "1" ? true : { $ne: true };
  filter.archived = get("archived") === "1" ? true : { $ne: true };
  if (get("difficulty")) filter.difficulty = get("difficulty");
  if (get("status")) filter.status = get("status");
  if (get("topic")) filter.topics = get("topic");
  if (get("platform")) filter.platform = get("platform");
  if (get("company")) filter.companies = get("company");
  if (get("pattern")) filter.pattern = get("pattern");
  if (get("starred") === "1") filter.isStarred = true;
  if (get("maxConfidence")) {
    filter.confidence = { $gt: 0, $lte: Number(get("maxConfidence")) };
  }

  const text = get("q").trim();
  if (text) {
    const rx = { $regex: escapeRegex(text), $options: "i" };
    filter.$or = [
      { title: rx },
      { notes: rx },
      { topics: rx },
      { companies: rx },
      { pattern: rx },
      { externalId: text.replace(/^#/, "") },
    ];
  }

  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const daysAgo = (n: number) => addDays(today, -n);

  switch (get("revision")) {
    case "queue":
      filter.nextRevisionAt = { $ne: null, $lt: tomorrow };
      break;
    case "overdue":
      filter.nextRevisionAt = { $ne: null, $lt: today };
      break;
    case "due":
      filter.nextRevisionAt = { $gte: today, $lt: tomorrow };
      break;
    case "upcoming":
      filter.nextRevisionAt = { $gte: tomorrow };
      break;
    case "none":
      filter.nextRevisionAt = null;
      break;
  }

  switch (get("lastDone")) {
    case "never":
      filter.lastSolvedAt = null;
      break;
    case "today":
      filter.lastSolvedAt = { $gte: today, $lt: tomorrow };
      break;
    case "7d":
      filter.lastSolvedAt = { $gte: daysAgo(6) };
      break;
    case "30d":
      filter.lastSolvedAt = { $gte: daysAgo(29) };
      break;
    case "90plus":
      filter.lastSolvedAt = { $ne: null, $lt: daysAgo(90) };
      break;
  }

  return filter;
}

// Null dates sort last (Mongo would put them first); difficulty sorts by rank, not alphabetically.
const SORTS: Record<string, Record<string, 1 | -1>> = {
  next: { _noNext: 1, nextRevisionAt: 1, updatedAt: -1 },
  last: { _noLast: 1, lastSolvedAt: 1 },
  difficulty: { _diffRank: 1, title: 1 },
  title: { title: 1 },
  times: { timesSolved: -1, title: 1 },
  updated: { updatedAt: -1 },
};

export async function listQuestions(search: URLSearchParams, viewer: Viewer) {
  const filter = buildQuestionFilter(search, viewer);
  const fallback = can(viewer, "practice.track") ? "next" : "updated";
  const sort = SORTS[search.get("sort") || fallback] ?? SORTS[fallback];
  const limit = Math.min(200, Math.max(1, Number(search.get("limit")) || PAGE_SIZE));
  const page = Math.max(1, Number(search.get("page")) || 1);

  const pipeline: PipelineStage[] = [
    { $match: { retired: filter.retired } },
    ...withProgress(viewer.id),
    { $match: filter },
    {
      $addFields: {
        _noNext: { $cond: [{ $ifNull: ["$nextRevisionAt", false] }, 0, 1] },
        _noLast: { $cond: [{ $ifNull: ["$lastSolvedAt", false] }, 0, 1] },
        _diffRank: {
          $switch: {
            branches: [
              { case: { $eq: ["$difficulty", "Easy"] }, then: 0 },
              { case: { $eq: ["$difficulty", "Hard"] }, then: 2 },
            ],
            default: 1,
          },
        },
      },
    },
    { $sort: { ...sort, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "n" }],
      },
    },
  ];
  const [res] = await Question.aggregate(pipeline);
  const total: number = res?.total?.[0]?.n ?? 0;
  return {
    items: (res?.items ?? []).map((d: Record<string, unknown>) => serializeQuestion(d)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Distinct values that exist in the data, for filter dropdowns. */
export async function questionFacets() {
  const live = { retired: { $ne: true } };
  const clean = (xs: unknown[]) =>
    xs
      .map(String)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  const [topics, companies, platforms, patterns] = await Promise.all([
    Question.distinct("topics", live),
    Question.distinct("companies", live),
    listOptions("platform"),
    listOptions("pattern"),
  ]);
  return {
    topics: clean(topics),
    companies: clean(companies),
    platforms: platforms.map((o) => o.name),
    patterns: patterns.map((o) => o.name),
  };
}

export type Facets = Awaited<ReturnType<typeof questionFacets>>;
