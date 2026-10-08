export type QuestionJSON = {
  _id: string;
  title: string;
  platform: string;
  platformUrl: string;
  externalId: string;
  videoUrls: string[];
  notes: string;
  topics: string[];
  companies: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  status: "todo" | "in_progress" | "done";
  timesSolved: number;
  lapses: number;
  lastSolvedAt: string | null;
  nextRevisionAt: string | null;
  revisionStage: number;
  confidence: number;
  timeSpentMinutes: number;
  totalMinutes: number;
  pattern: string;
  isStarred: boolean;
  /** Hidden by this user. */
  archived: boolean;
  /** Taken out of the catalog by an admin. */
  retired: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Video links from `videoUrls` (array) plus the legacy single `videoUrl`, trimmed and de-duplicated.
 * Works on stored documents and on request bodies alike.
 */
export function videoLinks(raw: Record<string, unknown>): string[] {
  const list = Array.isArray(raw.videoUrls) ? raw.videoUrls : [];
  const all = [...list, raw.videoUrl].map((v) => String(v ?? "").trim()).filter(Boolean);
  return [...new Set(all)];
}

const PROGRESS_KEYS = [
  "status",
  "timesSolved",
  "lapses",
  "lastSolvedAt",
  "nextRevisionAt",
  "revisionStage",
  "confidence",
  "timeSpentMinutes",
  "totalMinutes",
  "notes",
  "isStarred",
  "archived",
] as const;

/** The progress fields only (no ids or timestamps), so they don't overwrite the question's. */
function pickProgress(progress: Record<string, unknown> | null) {
  return Object.fromEntries(PROGRESS_KEYS.map((k) => [k, progress?.[k]]));
}

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A catalog question merged with one user's progress on it. Pass the progress separately, or
 * leave it out when `doc` already carries the merged fields (as list queries return them).
 */
export function serializeQuestion(question: Record<string, unknown>, progress?: Record<string, unknown> | null): QuestionJSON {
  const doc = progress === undefined ? question : { ...question, ...pickProgress(progress) };
  return {
    _id: String(doc._id),
    title: String(doc.title ?? ""),
    platform: String(doc.platform ?? "LeetCode"),
    platformUrl: String(doc.platformUrl ?? ""),
    externalId: String(doc.externalId ?? ""),
    videoUrls: videoLinks(doc),
    notes: String(doc.notes ?? ""),
    topics: Array.isArray(doc.topics) ? doc.topics.map(String) : [],
    companies: Array.isArray(doc.companies) ? doc.companies.map(String) : [],
    difficulty: (doc.difficulty as QuestionJSON["difficulty"]) || "Medium",
    status: (doc.status as QuestionJSON["status"]) || "todo",
    timesSolved: Number(doc.timesSolved ?? 0),
    lapses: Number(doc.lapses ?? 0),
    lastSolvedAt: iso(doc.lastSolvedAt),
    nextRevisionAt: iso(doc.nextRevisionAt),
    revisionStage: Number(doc.revisionStage ?? 0),
    confidence: Number(doc.confidence ?? 0),
    timeSpentMinutes: Number(doc.timeSpentMinutes ?? 0),
    totalMinutes: Number(doc.totalMinutes ?? 0),
    pattern: String(doc.pattern ?? ""),
    isStarred: Boolean(doc.isStarred),
    archived: Boolean(doc.archived),
    retired: Boolean(doc.retired),
    createdAt: iso(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(doc.updatedAt) ?? new Date().toISOString(),
  };
}

export type AttemptJSON = {
  _id: string;
  questionId: string;
  type: "solved" | "revised" | "failed_recall";
  at: string;
  confidence: number;
  minutes: number;
  onTime: boolean;
  difficulty: string;
  backfill: boolean;
};

export function serializeAttempt(doc: Record<string, unknown>): AttemptJSON {
  return {
    _id: String(doc._id),
    questionId: String(doc.questionId),
    type: doc.type as AttemptJSON["type"],
    at: iso(doc.at) ?? new Date(0).toISOString(),
    confidence: Number(doc.confidence ?? 0),
    minutes: Number(doc.minutes ?? 0),
    onTime: doc.onTime !== false,
    difficulty: String(doc.difficulty ?? "Medium"),
    backfill: Boolean(doc.backfill),
  };
}
