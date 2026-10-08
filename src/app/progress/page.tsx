"use client";

import Link from "next/link";
import { PracticeOnly } from "@/components/PracticeOnly";
import { useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Heatmap } from "@/components/Heatmap";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/dates";
import type { Stats } from "@/lib/stats";
import { useApi } from "@/lib/useApi";

const PERIODS = [
  ["day", "Today", "yesterday"],
  ["week", "Week", "last week"],
  ["month", "Month", "last month"],
  ["quarter", "Quarter", "last quarter"],
  ["half", "Half year", "last half"],
  ["year", "Year", "last year"],
  ["all", "All time", ""],
] as const;

type Metrics = Stats["period"]["current"];

export default function ProgressPage() {
  return (
    <PracticeOnly>
      <Progress />
    </PracticeOnly>
  );
}

function Progress() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("week");
  const { data: stats, error } = useApi<Stats>(`/api/stats?period=${period}`);
  const vsLabel = PERIODS.find((p) => p[0] === period)![2];

  if (error && !stats) return <ErrorPanel error={error} />;

  const cur = stats?.period.current;
  const prev = stats?.period.previous ?? null;

  return (
    <div className="grid gap-6">
      <h1 className="display text-3xl">Progress</h1>
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map(([id, label]) => (
          <button key={id} aria-pressed={period === id} onClick={() => setPeriod(id)} className="chip">
            {label}
          </button>
        ))}
      </div>

      {!stats || !cur || stats.period.name !== period ? (
        <Spinner />
      ) : (
        <>
          <p className="-mt-3 text-xs text-muted">
            {period === "all" ? "Everything logged" : `Since ${formatDate(stats.period.from)}`}
            {prev ? ` · compared with the same span ${vsLabel}` : ""}
          </p>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <Stat label="New solved" k="newSolves" cur={cur} prev={prev} />
            <Stat label="Revised" k="revisions" cur={cur} prev={prev} />
            <Stat label="Blanked" k="blanks" cur={cur} prev={prev} lowerIsBetter />
            <Stat label="Active days" k="activeDays" cur={cur} prev={prev} />
            <Stat label="Minutes" k="minutes" cur={cur} prev={prev} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="display text-xl">Difficulty of new solves</h2>
              <MixBar mix={cur.mix} />
            </section>
            <section className="card p-4">
              <h2 className="display text-xl">Topics practised</h2>
              <Bars rows={cur.topics} empty="Nothing logged in this window." />
            </section>
          </div>

          <section className="card p-4">
            <h2 className="display mb-3 text-xl">Activity</h2>
            <Heatmap cells={stats.heatmap} />
          </section>

          <section className="card p-4">
            <h2 className="display text-xl">All topics</h2>
            <p className="mt-1 text-xs text-muted">
              {stats.totals.done}/{stats.totals.total} done overall · streak {stats.streak.current}d (best{" "}
              {stats.streak.longest}d)
            </p>
            <ul className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
              {stats.topics.map((t) => (
                <li key={t.topic} className="text-sm">
                  <Link href={`/questions?topic=${encodeURIComponent(t.topic)}`} className="flex justify-between gap-2 hover:text-brass2">
                    <span className="truncate">{t.topic}</span>
                    <span className="shrink-0 text-muted">
                      {t.done}/{t.total}
                      {t.overdue ? <span className="text-warn"> · {t.overdue} overdue</span> : null}
                    </span>
                  </Link>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-good" style={{ width: `${t.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

type NumericKey = "newSolves" | "revisions" | "blanks" | "activeDays" | "minutes";

function Stat({
  label,
  k,
  cur,
  prev,
  lowerIsBetter,
}: {
  label: string;
  k: NumericKey;
  cur: Metrics;
  prev: Metrics | null;
  lowerIsBetter?: boolean;
}) {
  const now = cur[k];
  const delta = prev ? now - prev[k] : null;
  const good = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);
  const bad = delta !== null && (lowerIsBetter ? delta > 0 : delta < 0);
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-1 text-3xl">{now}</p>
      {delta !== null ? (
        <p className={`text-xs ${good ? "text-good" : bad ? "text-warn" : "text-muted"}`}>
          {delta === 0 ? "same as before" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)} vs ${prev![k]}`}
        </p>
      ) : null}
    </div>
  );
}

function MixBar({ mix }: { mix: Metrics["mix"] }) {
  const total = mix.Easy + mix.Medium + mix.Hard;
  if (!total) return <p className="mt-3 text-sm text-muted">No new solves in this window.</p>;
  const parts = [
    ["Easy", mix.Easy, "bg-easy"],
    ["Medium", mix.Medium, "bg-medium"],
    ["Hard", mix.Hard, "bg-hard"],
  ] as const;
  return (
    <div className="mt-3">
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map(([name, n, cls]) =>
          n ? <div key={name} className={cls} style={{ width: `${(n / total) * 100}%` }} title={`${name}: ${n}`} /> : null,
        )}
      </div>
      <p className="mt-2 text-sm text-muted">{parts.map(([name, n]) => `${name} ${n}`).join(" · ")}</p>
    </div>
  );
}

function Bars({ rows, empty }: { rows: { name: string; count: number }[]; empty: string }) {
  if (!rows.length) return <p className="mt-3 text-sm text-muted">{empty}</p>;
  const max = rows[0].count;
  return (
    <ul className="mt-3 grid gap-2">
      {rows.slice(0, 8).map((r) => (
        <li key={r.name} className="text-sm">
          <div className="flex justify-between">
            <span>{r.name}</span>
            <span className="text-muted">{r.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-good" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
