"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Spinner } from "@/components/Spinner";
import { useCan } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { HealthJSON } from "@/lib/health";
import { useApi } from "@/lib/useApi";

const GROUPS: { key: keyof HealthJSON["groups"]; label: string; hint: string; serious?: boolean }[] = [
  { key: "deadProblem", label: "Broken problem links", hint: "The problem page is gone (from the last link check).", serious: true },
  { key: "deadVideo", label: "Broken video links", hint: "Removed or wrong YouTube / video links (from the last link check).", serious: true },
  { key: "premium", label: "LeetCode Premium only", hint: "Most learners can't open these.", serious: true },
  { key: "searchVideo", label: "Only a YouTube search", hint: "Import put a search link here because it had no video. Add a real one." },
  { key: "noVideo", label: "No video", hint: "No explanation video at all." },
  { key: "noLink", label: "No problem link", hint: "Learners can't open the problem." },
  { key: "noPattern", label: "No pattern", hint: "Missing from pattern filters and stats." },
  { key: "noTopics", label: "No topics", hint: "Shows as “Untagged” in topic progress." },
  { key: "noCompanies", label: "No companies", hint: "Missing from company filters. Settings → Fill missing company tags can help for LeetCode / GFG." },
];

export default function HealthPage() {
  if (!useCan("catalog.edit")) return <ErrorPanel error="You don't have permission to manage the catalog." />;
  return <Health />;
}

function Health() {
  const { data, error, reload } = useApi<HealthJSON>("/api/health");
  const [open, setOpen] = useState<string | null>(null);
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const [runError, setRunError] = useState("");

  /** Checks every link in batches until none are left, showing progress. */
  async function checkLinks() {
    const since = new Date().toISOString();
    setRunError("");
    setRun({ done: 0, total: 0 });
    try {
      for (let guard = 0; guard < 200; guard++) {
        const r = await send<{ checked: number; remaining: number; total: number }>("/api/health/check", "POST", { since });
        setRun({ done: r.total - r.remaining, total: r.total });
        if (!r.remaining) break;
      }
      reload();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Link check failed");
    } finally {
      setRun(null);
    }
  }

  if (error && !data) return <ErrorPanel error={error} />;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <p className="eyebrow">Catalog</p>
        <h1 className="display text-3xl">Health</h1>
        <p className="text-sm text-muted">
          {data ? `${data.withIssues} of ${data.total} live questions have something to fix.` : <Spinner size="sm" />} Each row
          opens the question&apos;s editor.
        </p>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 text-sm">
          <p>Link check</p>
          <p className="text-xs text-muted">
            {run
              ? `Checking… ${run.done} of ${run.total || "?"} links`
              : data?.lastLinkCheck
                ? `Last run ${formatDate(data.lastLinkCheck.at, true)} · ${data.lastLinkCheck.checked} links. Broken links and Premium-only problems come from it.`
                : "Never run. Checks every problem and video link (takes a minute or two)."}
          </p>
          {runError ? <p className="text-xs text-warn">{runError}</p> : null}
        </div>
        <button onClick={checkLinks} disabled={Boolean(run)} className="btn-primary">
          {run ? "Checking…" : "Check links now"}
        </button>
      </section>

      {!data ? <Spinner className="min-h-[20vh]" /> : null}
      {data
        ? GROUPS.map((g) => {
            const rows = data.groups[g.key];
            const expanded = open === g.key;
            return (
              <section key={g.key} className="card">
                <button
                  onClick={() => setOpen(expanded ? null : g.key)}
                  disabled={!rows.length}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-default"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{g.label}</span>
                    <span className="block text-xs text-muted">{g.hint}</span>
                  </span>
                  <span
                    className={`display shrink-0 text-2xl ${!rows.length ? "text-good" : g.serious ? "text-warn" : "text-brass2"}`}
                  >
                    {rows.length || "✓"}
                  </span>
                </button>
                {expanded ? (
                  <ul className="border-t border-line">
                    {rows.map((r, i) => (
                      <li key={`${r._id}-${i}`} className="border-b border-line last:border-0">
                        <Link
                          href={`/questions/${r._id}?edit=1`}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2 text-sm hover:bg-white/5"
                        >
                          <span className="min-w-0">
                            {r.title} <span className="text-xs text-muted">· {r.platform}</span>
                          </span>
                          {r.detail ? <span className="max-w-full truncate text-xs text-warn">{r.detail}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })
        : null}
    </div>
  );
}
