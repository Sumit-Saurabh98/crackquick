"use client";

import Link from "next/link";
import { useState } from "react";
import { AttemptDialog } from "@/components/AttemptDialog";
import { CompanyTags } from "@/components/CompanyTags";
import type { AttemptResult } from "@/components/GradePanel";
import { DifficultyPill, RevisionPill, StatusPill } from "@/components/Pills";
import { useCan } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { QuestionJSON } from "@/lib/serialize";

export function QuestionRow({
  q,
  onChanged,
  onLogged,
  selected,
  onSelect,
}: {
  q: QuestionJSON;
  onChanged: () => void;
  onLogged?: (r: AttemptResult) => void;
  /** With `onSelect`, the row gets a checkbox for bulk actions. */
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
}) {
  const practises = useCan("practice.track");
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleStar() {
    setBusy(true);
    try {
      await send(`/api/questions/${q._id}`, "PATCH", { isStarred: !q.isStarred });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const meta = [
    q.externalId ? `${q.platform} #${q.externalId}` : q.platform,
    q.pattern,
    q.topics.join(", "),
    ...(practises
      ? [q.lastSolvedAt ? `last ${formatDate(q.lastSolvedAt)}` : "never solved", q.timesSolved ? `${q.timesSolved}× · conf ${q.confidence}/5` : ""]
      : []),
  ].filter(Boolean);

  return (
    <div
      className={`grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:items-center ${
        onSelect ? "grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto]" : "sm:grid-cols-[1fr_auto]"
      } ${selected ? "bg-brass/5" : ""}`}
    >
      {onSelect ? (
        <input
          type="checkbox"
          checked={Boolean(selected)}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${q.title}`}
          className="mt-1 size-4 self-start accent-[var(--brass)] sm:mt-0 sm:self-center"
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/questions/${q._id}`} className="font-medium hover:text-brass2">
            {q.isStarred ? <span className="text-brass">★ </span> : null}
            {q.title}
          </Link>
          <DifficultyPill value={q.difficulty} />
          {practises ? (
            <>
              <StatusPill value={q.status} />
              <RevisionPill q={q} />
            </>
          ) : null}
          {q.retired ? <span className="pill bg-warn/10 text-warn">retired</span> : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted">{meta.join(" · ")}</p>
        {q.companies.length ? (
          <div className="mt-1.5">
            <CompanyTags companies={q.companies} limit={4} />
          </div>
        ) : null}
      </div>
      <div className={`flex flex-wrap gap-2 ${onSelect ? "col-start-2 sm:col-start-auto" : ""}`}>
        {q.platformUrl ? (
          <a href={q.platformUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
            Open
          </a>
        ) : null}
        {practises ? (
          <>
            <button onClick={toggleStar} disabled={busy} className="btn btn-sm" aria-label={q.isStarred ? "Unstar" : "Star"}>
              {q.isStarred ? "★" : "☆"}
            </button>
            <button onClick={() => setLogging(true)} className="btn-primary btn-sm">
              Log
            </button>
          </>
        ) : (
          <Link href={`/questions/${q._id}`} className="btn btn-sm">
            Manage
          </Link>
        )}
      </div>
      {logging ? (
        <AttemptDialog
          q={q}
          onClose={() => setLogging(false)}
          onSaved={(r) => {
            setLogging(false);
            onLogged?.(r);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
