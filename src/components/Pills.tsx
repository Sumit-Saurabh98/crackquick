import { formatDate } from "@/lib/dates";
import { revisionState } from "@/lib/revision";
import type { QuestionJSON } from "@/lib/serialize";

export function DifficultyPill({ value }: { value: QuestionJSON["difficulty"] }) {
  const color = value === "Easy" ? "text-easy bg-easy/15" : value === "Hard" ? "text-hard bg-hard/15" : "text-medium bg-medium/15";
  return <span className={`pill ${color}`}>{value}</span>;
}

export function StatusPill({ value }: { value: QuestionJSON["status"] }) {
  const map = {
    todo: "text-muted bg-white/5",
    in_progress: "text-brass2 bg-brass/15",
    done: "text-good bg-good/15",
  };
  return <span className={`pill ${map[value]}`}>{value === "in_progress" ? "in progress" : value}</span>;
}

/** Due-state pill; renders nothing for unscheduled questions. */
export function RevisionPill({ q }: { q: QuestionJSON }) {
  const state = revisionState(q.nextRevisionAt);
  if (state === "none") return null;
  const map = {
    overdue: ["text-warn bg-warn/15", "overdue"],
    due: ["text-brass2 bg-brass/20", "due today"],
    upcoming: ["text-muted bg-white/5", `next ${formatDate(q.nextRevisionAt)}`],
  } as const;
  const [cls, label] = map[state];
  return <span className={`pill ${cls}`}>{label}</span>;
}
