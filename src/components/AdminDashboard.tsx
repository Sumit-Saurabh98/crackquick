"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AuditList } from "@/components/AuditList";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useCan } from "@/components/ViewerProvider";
import { formatDate } from "@/lib/dates";
import type { OverviewJSON } from "@/lib/overview";
import { ROLE_INFO } from "@/lib/rbac";
import { useApi } from "@/lib/useApi";

/** Home for management roles: what needs attention, and what changed lately. */
export function AdminDashboard() {
  const { data, error, reload } = useApi<OverviewJSON>("/api/admin/overview");
  const canEdit = useCan("catalog.edit");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  if (error && !data) return <ErrorPanel error={error} />;
  if (!data) return <Spinner />;
  const { catalog, submissions, users } = data;

  return (
    <div className="grid gap-6">
      <section>
        <p className="eyebrow">{formatDate(new Date())}</p>
        <h1 className="display text-4xl text-brass2">Dashboard</h1>
      </section>

      {submissions && submissions.pending > 0 ? (
        <Link
          href="/submissions"
          className="card flex flex-wrap items-center justify-between gap-3 border-brass/40 p-4 hover:border-brass"
        >
          <span>
            <span className="display text-2xl text-brass2">{submissions.pending}</span>{" "}
            {submissions.pending === 1 ? "suggestion is" : "suggestions are"} waiting for review
            {submissions.oldestAt ? <span className="text-sm text-muted"> · oldest from {formatDate(submissions.oldestAt)}</span> : null}
          </span>
          <span className="btn-primary">Review</span>
        </Link>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {users ? (
          <>
            <Tile label="Users" value={users.total} href="/users" />
            <Tile label="Active this week" value={users.activeSince} hint="signed in or practised" href="/users" />
            <Tile label="New this week" value={users.newSince} href="/users" />
          </>
        ) : null}
        {submissions ? <Tile label="Pending suggestions" value={submissions.pending} href="/submissions" warn={submissions.pending > 0} /> : null}
        <Tile label="Questions" value={catalog.live} href="/questions" />
        <Tile label="Added this week" value={catalog.addedWeek} href="/questions" />
        <Tile label="Retired" value={catalog.retired} hint={`${catalog.retiredMonth} in the last 30 days`} href="/questions?retired=1" />
        <Tile label="Attempts this week" value={catalog.attemptsWeek} hint="by all learners" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {canEdit ? (
          <section className="card grid content-start gap-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-xl">Recent changes</h2>
              <Link href="/audit" className="text-sm text-brass2">
                All changes
              </Link>
            </div>
            <AuditList
              items={data.recentChanges}
              showQuestion
              onChanged={(m) => {
                setToast(m);
                reload();
              }}
            />
          </section>
        ) : null}

        {users ? (
          <section className="card grid content-start gap-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-xl">Newest users</h2>
              <Link href="/users" className="text-sm text-brass2">
                Manage
              </Link>
            </div>
            <ul className="grid gap-2 text-sm">
              {users.recent.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{u.name || u.email}</span>
                  <span className="text-xs text-muted">
                    {ROLE_INFO[u.role].label}
                    {u.createdAt ? ` · ${formatDate(u.createdAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function Tile({ label, value, hint, href, warn }: { label: string; value: number; hint?: string; href?: string; warn?: boolean }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className={`display mt-1 text-3xl ${warn ? "text-brass2" : ""}`}>{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 hover:border-brass/40">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}
