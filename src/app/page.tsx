"use client";

import Link from "next/link";
import { AdminDashboard } from "@/components/AdminDashboard";
import { FeaturedCard } from "@/components/FeaturedCard";
import { PracticeOnly } from "@/components/PracticeOnly";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Heatmap } from "@/components/Heatmap";
import { DifficultyPill, RevisionPill } from "@/components/Pills";
import { Spinner } from "@/components/Spinner";
import { useCan } from "@/components/ViewerProvider";
import { formatDate } from "@/lib/dates";
import type { Stats } from "@/lib/stats";
import { useApi } from "@/lib/useApi";

/** Learners get their Desk; management-only roles (admins) get the admin dashboard. */
export default function DeskPage() {
  const practises = useCan("practice.track");
  const editsCatalog = useCan("catalog.edit");
  const reviews = useCan("submissions.review");
  const managesUsers = useCan("users.manage");
  if (!practises && (editsCatalog || reviews || managesUsers)) return <AdminDashboard />;
  return (
    <PracticeOnly>
      <Desk />
    </PracticeOnly>
  );
}

function Desk() {
  const { data: stats, error } = useApi<Stats>("/api/stats?period=day");
  const canEdit = useCan("catalog.edit");

  if (error && !stats) return <ErrorPanel error={error} />;
  if (!stats) return <Spinner />;

  const t = stats.totals;
  if (t.total === 0) {
    return (
      <div className="card mx-auto grid max-w-xl gap-4 p-8 text-center">
        <h1 className="display text-3xl text-brass2">{canEdit ? "Start the catalog" : "Nothing to practise yet"}</h1>
        <p className="text-sm text-muted">
          {canEdit
            ? "Add problems from LeetCode or GeeksforGeeks by number or link, or add your own. Everyone gets them."
            : "The catalog is empty. Suggest a problem and an admin or editor will add it."}
        </p>
        <div className="flex justify-center">
          <Link href="/questions/new" className="btn-primary">
            {canEdit ? "Add questions" : "Suggest a question"}
          </Link>
        </div>
      </div>
    );
  }

  const queueCount = t.overdue + t.dueToday;
  const pct = Math.round((t.done / t.total) * 100);

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDate(new Date())}</p>
          <h1 className="display text-4xl text-brass2">
            {t.done} / {t.total} done
          </h1>
          <p className="mt-1 text-sm text-muted">
            {pct}% · {t.inProgress} in progress · {t.todo} not started
          </p>
        </div>
        {queueCount > 0 ? (
          <Link href="/review" className="btn-primary">
            Start review · {queueCount}
          </Link>
        ) : null}
      </section>

      <div className="h-2 overflow-hidden rounded-full bg-white/5" aria-label={`${pct}% done`}>
        <div className="h-full bg-good" style={{ width: `${pct}%` }} />
      </div>

      {stats.countdown ? (
        <p className="text-sm text-muted">
          <span className="text-ink">{stats.countdown.daysLeft} days</span> to interview (
          {formatDate(stats.countdown.date)}) · {stats.countdown.remaining} not done yet
          {stats.countdown.remaining > 0 ? (
            <>
              {" "}
              → <span className="text-ink">{pace(stats.countdown.remaining, stats.countdown.daysLeft)}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <FeaturedCard />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Due today" value={t.dueToday} href="/questions?revision=due" />
        <Tile label="Overdue" value={t.overdue} href="/questions?revision=overdue" warn={t.overdue > 0} />
        <Tile label="In progress" value={t.inProgress} href="/questions?status=in_progress" />
        <Tile
          label="Streak"
          value={`${stats.streak.current}d`}
          hint={stats.streak.activeToday || stats.streak.current === 0 ? `best ${stats.streak.longest}d` : "practise today to keep it"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-xl">To revise</h2>
            {queueCount > stats.reviewQueue.length ? (
              <Link href="/questions?revision=queue" className="text-sm text-brass2">
                All {queueCount}
              </Link>
            ) : null}
          </div>
          {stats.reviewQueue.length === 0 ? (
            <p className="text-sm text-muted">Nothing due. Solve something new.</p>
          ) : (
            <ul className="grid gap-2">
              {stats.reviewQueue.map((q) => (
                <li key={q._id}>
                  <Link
                    href={`/questions/${q._id}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 hover:border-brass/40"
                  >
                    <span className="font-medium">{q.title}</span>
                    <DifficultyPill value={q.difficulty} />
                    <RevisionPill q={q} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="display text-xl">Topics</h2>
          <ul className="mt-3 grid gap-2">
            {stats.topics.slice(0, 8).map((tp) => (
              <li key={tp.topic} className="text-sm">
                <Link href={`/questions?topic=${encodeURIComponent(tp.topic)}`} className="flex justify-between gap-2 hover:text-brass2">
                  <span className="truncate">{tp.topic}</span>
                  <span className="shrink-0 text-muted">
                    {tp.done}/{tp.total}
                    {tp.overdue ? <span className="text-warn"> · {tp.overdue} overdue</span> : null}
                  </span>
                </Link>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full bg-good" style={{ width: `${tp.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {stats.topics.length > 8 ? (
            <Link href="/progress" className="mt-3 inline-block text-sm text-brass2">
              All topics
            </Link>
          ) : null}
        </section>
      </div>

      <section className="card p-4">
        <h2 className="display mb-3 text-xl">Activity</h2>
        <Heatmap cells={stats.heatmap} />
      </section>
    </div>
  );
}

/** "3/day", or "1 every 4 days" when less than one a day is needed. */
function pace(remaining: number, daysLeft: number) {
  if (daysLeft <= 0) return `${remaining} today`;
  const perDay = remaining / daysLeft;
  return perDay >= 1 ? `${Math.ceil(perDay * 10) / 10}/day` : `1 every ${Math.floor(daysLeft / remaining)} days`;
}

function Tile({ label, value, hint, href, warn }: { label: string; value: number | string; hint?: string; href?: string; warn?: boolean }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className={`display mt-1 text-3xl ${warn ? "text-warn" : ""}`}>{value}</p>
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
