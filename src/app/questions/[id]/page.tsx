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
import { useCan } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { AttemptJSON, QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";

const KIND_LABEL = { solved: "Solved", revised: "Revised", failed_recall: "Blanked" } as const;

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canEdit = useCan("catalog.edit");
  const canDelete = useCan("catalog.delete");
  // Admins manage the catalog only: no log, schedule, notes, history, star or hide.
  const practises = useCan("practice.track");
  const question = useApi<{ item: QuestionJSON }>(`/api/questions/${id}`);
  const history = useApi<{ items: AttemptJSON[] }>(practises ? `/api/questions/${id}/attempts` : null);
  const [editing, setEditing] = useState<"" | "edit" | "suggest-edit">("");
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
    if (!confirm("Permanently delete this question from the catalog, with all progress and attempts on it?\n\nUse Retire to take it out of the catalog but keep everyone's history.")) return;
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
            ← {practises ? "Library" : "Catalog"}
          </Link>
          <h1 className="display text-3xl">
            {practises && item.isStarred ? <span className="text-brass">★ </span> : null}
            {item.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <DifficultyPill value={item.difficulty} />
            {practises ? (
              <>
                <StatusPill value={item.status} />
                <RevisionPill q={item} />
              </>
            ) : null}
            {item.retired ? <span className="pill bg-warn/10 text-warn">retired</span> : null}
            {item.archived ? <span className="pill bg-white/5 text-muted">hidden</span> : null}
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
          {practises ? (
            <button onClick={() => setLogging(true)} className="btn-primary">
              Log attempt
            </button>
          ) : null}
        </div>
      </div>

      {practises ? (
        <>
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
        </>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {practises ? (
          <>
            <button
              disabled={busy}
              onClick={() => act(() => send(`/api/questions/${id}`, "PATCH", { isStarred: !item.isStarred }))}
              className="btn"
            >
              {item.isStarred ? "Unstar" : "Star"}
            </button>
            <StatusControl status={item.status} busy={busy} onChange={(status) => act(() => send(`/api/questions/${id}`, "PATCH", { status }))} />
            <button
              disabled={busy}
              onClick={() =>
                act(
                  () => send(`/api/questions/${id}`, "PATCH", { archived: !item.archived }),
                  item.archived ? "Back in your lists" : "Hidden from your lists and queue",
                )
              }
              className="btn"
              title="Only for you; your history is kept"
            >
              {item.archived ? "Unhide" : "Hide for me"}
            </button>
          </>
        ) : null}
        {canEdit ? (
          <>
            <button onClick={() => setEditing((v) => (v ? "" : "edit"))} className="btn sm:ml-auto">
              {editing ? "Close editor" : "Edit details"}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                act(
                  () => send(`/api/questions/${id}`, "PATCH", { retired: !item.retired }),
                  item.retired ? "Back in the catalog" : "Retired: gone from everyone's lists, history kept",
                )
              }
              className="btn"
            >
              {item.retired ? "Restore to catalog" : "Retire"}
            </button>
            {canDelete ? (
              <button disabled={busy} onClick={remove} className="btn border-warn/40 text-warn">
                Delete
              </button>
            ) : null}
          </>
        ) : !item.retired ? (
          <button onClick={() => setEditing((v) => (v ? "" : "suggest-edit"))} className="btn sm:ml-auto">
            {editing ? "Close" : "Suggest an edit"}
          </button>
        ) : null}
      </section>
      {actionError ? <p className="text-sm text-warn">{actionError}</p> : null}

      {editing ? (
        <div className="grid gap-2">
          {editing === "suggest-edit" ? (
            <p className="text-sm text-muted">
              Change anything that&apos;s wrong or missing (a video, a company, the pattern…). An admin or editor reviews it before it
              applies for everyone.
            </p>
          ) : null}
          <QuestionForm
            key={item.updatedAt}
            mode={editing}
            initial={item}
            onSaved={() => {
              setToast(editing === "edit" ? "Saved" : "Sent for review. Track it under Submissions.");
              setEditing("");
              refresh();
            }}
          />
        </div>
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

/** Your own status. Done only comes from logging an attempt; leaving done clears your schedule. */
function StatusControl({
  status,
  busy,
  onChange,
}: {
  status: QuestionJSON["status"];
  busy: boolean;
  onChange: (status: "todo" | "in_progress") => void;
}) {
  if (status === "done") {
    return (
      <button
        disabled={busy}
        onClick={() => confirm("Reset to todo? This clears your revision schedule (attempt history is kept).") && onChange("todo")}
        className="btn"
      >
        Reset to todo
      </button>
    );
  }
  return (
    <button disabled={busy} onClick={() => onChange(status === "todo" ? "in_progress" : "todo")} className="btn">
      {status === "todo" ? "Mark in progress" : "Back to todo"}
    </button>
  );
}
