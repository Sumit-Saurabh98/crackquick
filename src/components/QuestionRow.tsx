"use client";

import Link from "next/link";
import { useState } from "react";
import { AttemptDialog } from "@/components/AttemptDialog";
import { CompanyTags } from "@/components/CompanyTags";
import type { AttemptResult } from "@/components/GradePanel";
import { DifficultyPill, RevisionPill, StatusPill } from "@/components/Pills";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { QuestionJSON } from "@/lib/serialize";

export function QuestionRow({
  q,
  onChanged,
  onLogged,
}: {
  q: QuestionJSON;
  onChanged: () => void;
  onLogged?: (r: AttemptResult) => void;
}) {
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
    q.topics.join(", "),
    q.lastSolvedAt ? `last ${formatDate(q.lastSolvedAt)}` : "never solved",
    q.timesSolved ? `${q.timesSolved}× · conf ${q.confidence}/5` : "",
  ].filter(Boolean);

  return (
    <div className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/questions/${q._id}`} className="font-medium hover:text-brass2">
            {q.isStarred ? <span className="text-brass">★ </span> : null}
            {q.title}
          </Link>
          <DifficultyPill value={q.difficulty} />
          <StatusPill value={q.status} />
          <RevisionPill q={q} />
        </div>
        <p className="mt-1 truncate text-xs text-muted">{meta.join(" · ")}</p>
        {q.companies.length ? (
          <div className="mt-1.5">
            <CompanyTags companies={q.companies} limit={4} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {q.platformUrl ? (
          <a href={q.platformUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
            Open
          </a>
        ) : null}
        <button onClick={toggleStar} disabled={busy} className="btn btn-sm" aria-label={q.isStarred ? "Unstar" : "Star"}>
          {q.isStarred ? "★" : "☆"}
        </button>
        <button onClick={() => setLogging(true)} className="btn-primary btn-sm">
          Log
        </button>
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
