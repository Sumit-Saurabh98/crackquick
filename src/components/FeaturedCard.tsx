"use client";

import Link from "next/link";
import { useState } from "react";
import { AttemptDialog } from "@/components/AttemptDialog";
import { DifficultyPill, StatusPill } from "@/components/Pills";
import { useCan } from "@/components/ViewerProvider";
import type { QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";

type Featured = { item: QuestionJSON | null; cycle?: number; covered?: number; total?: number };

/** Question of the day: the same for everyone, cycling through the whole catalog without repeats. */
export function FeaturedCard({ onLogged }: { onLogged?: (message: string) => void }) {
  const practises = useCan("practice.track");
  const { data, reload } = useApi<Featured>("/api/featured");
  const [logging, setLogging] = useState(false);
  const q = data?.item;
  if (!q) return null;
  const solved = q.status === "done";

  return (
    <section className="card relative overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-brass" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="eyebrow text-brass2">Question of the day</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Link href={`/questions/${q._id}`} className="display text-xl hover:text-brass2">
              {q.title}
            </Link>
            <DifficultyPill value={q.difficulty} />
            {practises ? <StatusPill value={q.status} /> : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {[q.externalId ? `${q.platform} #${q.externalId}` : q.platform, q.pattern, q.topics.slice(0, 3).join(", ")]
              .filter(Boolean)
              .join(" · ")}
            {!practises && data?.total ? ` · cycle ${data.cycle}: ${data.covered} of ${data.total} featured` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {q.platformUrl ? (
            <a href={q.platformUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
              Solve on {q.platform} ↗
            </a>
          ) : null}
          {practises ? (
            <button onClick={() => setLogging(true)} className="btn-primary btn-sm">
              {solved ? "Log a revision" : "Log"}
            </button>
          ) : null}
        </div>
      </div>
      {logging ? (
        <AttemptDialog
          q={q}
          onClose={() => setLogging(false)}
          onSaved={() => {
            setLogging(false);
            reload();
            onLogged?.("Logged today's question");
          }}
        />
      ) : null}
    </section>
  );
}
