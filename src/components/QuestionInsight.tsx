"use client";

import Link from "next/link";
import { AuditList } from "@/components/AuditList";
import { Spinner } from "@/components/Spinner";
import type { AuditJSON } from "@/lib/audit";
import type { InsightJSON } from "@/lib/insight";
import { useApi } from "@/lib/useApi";

/** For catalog editors: how everyone is doing on this question (totals only). */
export function QuestionInsight({ id }: { id: string }) {
  const { data, error } = useApi<InsightJSON>(`/api/questions/${id}/insight`);
  return (
    <section className="card grid gap-4 p-5">
      <div>
        <h2 className="display text-xl">Insight</h2>
        <p className="text-xs text-muted">Across everyone who practises; totals only, never an individual&apos;s data.</p>
      </div>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {!data && !error ? <Spinner /> : null}
      {data ? (
        <>
          <div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5" aria-label="Done, in progress, not started">
              <div className="h-full bg-good" style={{ width: pct(data.done, data.learners) }} />
              <div className="h-full bg-brass" style={{ width: pct(data.inProgress, data.learners) }} />
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                <span className="text-good">●</span> {data.done} done
              </span>
              <span>
                <span className="text-brass">●</span> {data.inProgress} in progress
              </span>
              <span>{data.notStarted} not started</span>
              <span>
                of {data.learners} learner{data.learners === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Attempts" value={data.attempts ? `${data.attempts} by ${data.people}` : "none yet"} />
            <Stat label="Blank rate" value={data.attempts ? `${Math.round(data.blankRate * 100)}%` : "—"} />
            <Stat label="Avg confidence" value={data.avgConfidence !== null ? `${data.avgConfidence.toFixed(1)} / 5` : "—"} />
            <Stat label="Avg time" value={data.avgMinutes !== null ? `${Math.round(data.avgMinutes)} min` : "—"} />
          </dl>
          <p className="text-xs text-muted">
            Starred by {data.starred} · hidden by {data.hidden}
          </p>
          {data.notes.length ? (
            <ul className="grid gap-1.5">
              {data.notes.map((n) => (
                <li key={n} className="rounded-lg bg-brass/10 px-3 py-2 text-sm text-brass2">
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** This question's catalog changes, newest first, with revert. */
export function QuestionChanges({ id, onChanged }: { id: string; onChanged: (message: string) => void }) {
  const { data, error, reload } = useApi<{ items: AuditJSON[]; pages: number }>(`/api/audit?questionId=${id}`);
  return (
    <section className="card grid gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl">Changes</h2>
        <Link href="/audit" className="text-xs text-brass2">
          All catalog changes
        </Link>
      </div>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {data ? (
        <AuditList
          items={data.items}
          onChanged={(m) => {
            reload();
            onChanged(m);
          }}
        />
      ) : !error ? (
        <Spinner />
      ) : null}
    </section>
  );
}

function pct(n: number, total: number) {
  return `${total ? Math.min(100, (n / total) * 100) : 0}%`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
