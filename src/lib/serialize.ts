export type QuestionJSON = {
  _id: string;
  title: string;
  platform: string;
  platformUrl: string;
  externalId: string;
  videoUrl: string;
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
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function serializeQuestion(doc: Record<string, unknown>): QuestionJSON {
  return {
    _id: String(doc._id),
    title: String(doc.title ?? ""),
    platform: String(doc.platform ?? "LeetCode"),
    platformUrl: String(doc.platformUrl ?? ""),
    externalId: String(doc.externalId ?? ""),
    videoUrl: String(doc.videoUrl ?? ""),
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
