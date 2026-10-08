"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AttemptDialog } from "@/components/AttemptDialog";
import { CompanyTags } from "@/components/CompanyTags";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Markdown } from "@/components/Markdown";
import { DifficultyPill, RevisionPill, StatusPill } from "@/components/Pills";
import { QuestionForm } from "@/components/QuestionForm";
import { Spinner } from "@/components/Spinner";
import { attemptMessage, Toast } from "@/components/Toast";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { AttemptJSON, QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";

const KIND_LABEL = { solved: "Solved", revised: "Revised", failed_recall: "Blanked" } as const;

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const question = useApi<{ item: QuestionJSON }>(`/api/questions/${id}`);
  const history = useApi<{ items: AttemptJSON[] }>(`/api/questions/${id}/attempts`);
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  const refresh = () => {
    question.reload();
    history.reload();
  };

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setActionError("");
    try {
      await fn();
      if (done) setToast(done);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Permanently delete this question AND its attempt history (XP, streak days)?\n\nUse Archive to hide it but keep history.")) return;
    setBusy(true);
    try {
      await send(`/api/questions/${id}`, "DELETE");
      router.push("/questions");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  if (question.error && !question.data) return <ErrorPanel error={question.error} />;
  const item = question.data?.item;
  if (!item) return <Spinner />;
  const attempts = history.data?.items ?? [];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/questions" className="text-xs text-muted hover:text-ink">
            ← Library
          </Link>
          <h1 className="display text-3xl">
            {item.isStarred ? <span className="text-brass">★ </span> : null}
            {item.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <DifficultyPill value={item.difficulty} />
            <StatusPill value={item.status} />
            <RevisionPill q={item} />
            {item.archived ? <span className="pill bg-white/5 text-muted">archived</span> : null}
            {item.pattern ? (
              <Link href={`/questions?pattern=${encodeURIComponent(item.pattern)}`} className="pill bg-brass/15 text-brass2 normal-case">
                {item.pattern}
              </Link>
            ) : null}
            {item.topics.map((tag, i) => (
              <span key={`${tag}-${i}`} className="pill bg-white/5 text-muted normal-case">
                {tag}
              </span>
            ))}
          </div>
          {item.companies.length ? (
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <span className="eyebrow pt-0.5">Asked at</span>
              <div className="min-w-0 flex-1">
                <CompanyTags companies={item.companies} limit={12} size="md" />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.platformUrl ? (
            <a href={item.platformUrl} target="_blank" rel="noreferrer" className="btn">
              {item.platform} ↗
            </a>
          ) : null}
          {item.videoUrls.map((url, i, all) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="btn">
              Video{all.length > 1 ? ` ${i + 1}` : ""} ↗
            </a>
          ))}
          <button onClick={() => setLogging(true)} className="btn-primary">
            Log attempt
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Last solved", formatDate(item.lastSolvedAt, true)],
          ["Next revision", item.nextRevisionAt ? formatDate(item.nextRevisionAt) : "not scheduled"],
          ["Times solved", `${item.timesSolved}×${item.lapses ? ` · blanked ${item.lapses}×` : ""}`],
          ["Time spent", item.totalMinutes ? `${item.totalMinutes} min total` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="eyebrow">{k}</p>
            <p className="mt-1 text-sm">{v}</p>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="display text-xl">Notes</h2>
          {notesDraft === null ? (
            <button onClick={() => setNotesDraft(item.notes)} className="btn btn-sm">
              Edit notes
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setNotesDraft(null)} className="btn btn-sm">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await send(`/api/questions/${id}`, "PATCH", { notes: notesDraft });
                    setNotesDraft(null);
                  }, "Notes saved")
                }
                className="btn-primary btn-sm"
              >
                Save
              </button>
            </div>
          )}
        </div>
        {notesDraft !== null ? (
          <textarea
            autoFocus
            rows={14}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            className="field mt-3 w-full font-mono text-[13px]"
            placeholder={"## Approach\n\n## Pitfalls\n\n## Complexity\nO(n) time, O(1) space\n\n```python\n```"}
          />
        ) : item.notes ? (
          <div className="mt-3">
            <Markdown>{item.notes}</Markdown>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No notes yet. Write the approach, the trick, pitfalls and complexity.</p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-xl">History</h2>
          {attempts.length ? (
            <button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await send(`/api/questions/${id}/attempts/last`, "DELETE");
                  setToast("Undid last log");
                })
              }
              className="btn btn-sm"
            >
              Undo last log
            </button>
          ) : null}
        </div>
        {attempts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No attempts yet.</p>
        ) : (
          <ol className="mt-3 grid gap-2">
            {attempts.map((a) => (
              <li key={a._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-line pl-3 text-sm">
                <span className={a.type === "failed_recall" ? "text-warn" : a.type === "solved" ? "text-good" : "text-ink"}>
                  {KIND_LABEL[a.type]}
                </span>
                <span className="text-muted">{formatDate(a.at, !a.backfill)}</span>
                {a.type !== "failed_recall" ? <span className="text-muted">conf {a.confidence}/5</span> : null}
                {a.minutes ? <span className="text-muted">{a.minutes} min</span> : null}
                {a.backfill ? <span className="pill bg-white/5 text-muted">backfill</span> : null}
                {!a.onTime && !a.backfill ? <span className="pill bg-warn/10 text-warn">late</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <button onClick={() => setEditing((v) => !v)} className="btn">
          {editing ? "Close editor" : "Edit details"}
        </button>
        <button
          disabled={busy}
          onClick={() => act(() => send(`/api/questions/${id}`, "PATCH", { isStarred: !item.isStarred }))}
          className="btn"
        >
          {item.isStarred ? "Unstar" : "Star"}
        </button>
        <button
          disabled={busy}
          onClick={() =>
            act(
              () => send(`/api/questions/${id}`, "PATCH", { archived: !item.archived }),
              item.archived ? "Restored" : "Archived: hidden from lists and queue",
            )
          }
          className="btn"
        >
          {item.archived ? "Unarchive" : "Archive"}
        </button>
        <button disabled={busy} onClick={remove} className="btn border-warn/40 text-warn">
          Delete
        </button>
      </section>
      {actionError ? <p className="text-sm text-warn">{actionError}</p> : null}

      {editing ? (
        <QuestionForm
          key={item.updatedAt}
          initial={item}
          onSaved={() => {
            setEditing(false);
            setToast("Saved");
            refresh();
          }}
        />
      ) : null}

      {logging ? (
        <AttemptDialog
          q={item}
          onClose={() => setLogging(false)}
          onSaved={(r) => {
            setLogging(false);
            setToast(attemptMessage(r));
            refresh();
          }}
        />
      ) : null}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
