"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { DifficultyPill } from "@/components/Pills";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useCan } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import type { DuplicatePair } from "@/lib/duplicates";
import { useApi } from "@/lib/useApi";

type Card = DuplicatePair["a"];

export default function DuplicatesPage() {
  if (!useCan("catalog.edit")) return <ErrorPanel error="You don't have permission to manage the catalog." />;
  return <Duplicates />;
}

function Duplicates() {
  const canMerge = useCan("catalog.delete");
  const { data, error, reload } = useApi<{ items: DuplicatePair[] }>("/api/duplicates");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setActionError("");
    try {
      setToast(await fn());
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  function merge(keep: Card, drop: Card, key: string) {
    const msg =
      `Keep “${keep.title}” (${keep.platform}) and merge “${drop.title}” (${drop.platform}) into it?\n\n` +
      `• Everyone's progress and attempts on the second move to the first (${drop.learners} learner${drop.learners === 1 ? "" : "s"}, ${drop.attempts} attempt${drop.attempts === 1 ? "" : "s"}).\n` +
      "• Its videos, topics and companies are added to the kept one.\n" +
      "• It's then retired. Both changes appear in the change history.";
    if (!confirm(msg)) return;
    void run(key, async () => {
      const r = await send<{ moved: number; combined: number; attempts: number }>("/api/duplicates/merge", "POST", {
        keepId: keep._id,
        dropId: drop._id,
      });
      return `Merged: ${r.moved + r.combined} learner record${r.moved + r.combined === 1 ? "" : "s"} and ${r.attempts} attempt${r.attempts === 1 ? "" : "s"} moved`;
    });
  }

  if (error && !data) return <ErrorPanel error={error} />;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div>
        <p className="eyebrow">Catalog</p>
        <h1 className="display text-3xl">Possible duplicates</h1>
        <p className="text-sm text-muted">
          Questions with the same title (ignoring case, punctuation and numbering), a one-letter typo, or the same problem
          link. Numbered variants like “House Robber II” are never matched.
          {canMerge ? "" : " Merging needs an admin (it can't be undone with one click)."}
        </p>
      </div>
      {actionError ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{actionError}</p> : null}
      {!data ? <Spinner className="min-h-[30vh]" /> : null}
      {data && !data.items.length ? <p className="card p-6 text-sm text-muted">No likely duplicates. 🎉</p> : null}
      {data?.items.map((p) => {
        const key = `${p.a._id}:${p.b._id}`;
        return (
          <article key={key} className="card grid gap-3 p-4">
            <p className="text-xs text-muted">
              <span className="pill bg-brass/15 text-brass2">{p.reason}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[p.a, p.b].map((q, i) => {
                const other = i === 0 ? p.b : p.a;
                return (
                  <div key={q._id} className="grid content-start gap-2 rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/questions/${q._id}`} className="font-medium hover:text-brass2">
                        {q.title}
                      </Link>
                      <DifficultyPill value={q.difficulty as "Easy" | "Medium" | "Hard"} />
                    </div>
                    <p className="text-xs text-muted">
                      {[
                        q.externalId ? `${q.platform} #${q.externalId}` : q.platform,
                        `${q.learners} learner${q.learners === 1 ? "" : "s"}`,
                        `${q.attempts} attempt${q.attempts === 1 ? "" : "s"}`,
                        `${q.videos} video${q.videos === 1 ? "" : "s"}`,
                        `${q.companies} compan${q.companies === 1 ? "y" : "ies"}`,
                      ].join(" · ")}
                    </p>
                    {q.platformUrl ? (
                      <a href={q.platformUrl} target="_blank" rel="noreferrer" className="truncate text-xs text-brass2 hover:underline">
                        {q.platformUrl}
                      </a>
                    ) : null}
                    {canMerge ? (
                      <div>
                        <button disabled={busy !== ""} onClick={() => merge(q, other, key)} className="btn btn-sm">
                          Keep this one
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                disabled={busy !== ""}
                onClick={() =>
                  run(key, async () => {
                    await send("/api/duplicates/dismiss", "POST", { a: p.a._id, b: p.b._id });
                    return "Marked as not duplicates";
                  })
                }
                className="btn btn-sm"
              >
                {busy === key ? "Working…" : "Not duplicates"}
              </button>
            </div>
          </article>
        );
      })}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
