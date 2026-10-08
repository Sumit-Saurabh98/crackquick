"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useCan } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import type { CatalogFields } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { FIELD_LABEL } from "@/lib/fieldLabels";
import type { SubmissionJSON } from "@/lib/submissions";
import { useApi } from "@/lib/useApi";


const STATUS_STYLE: Record<SubmissionJSON["status"], string> = {
  pending: "bg-brass/15 text-brass2",
  approved: "bg-good/15 text-good",
  rejected: "bg-warn/15 text-warn",
};

const TABS = [
  { id: "pending", label: "Pending", query: "status=pending" },
  { id: "approved", label: "Approved", query: "status=approved" },
  { id: "rejected", label: "Rejected", query: "status=rejected" },
  { id: "mine", label: "Mine", query: "mine=1" },
] as const;

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SubmissionsView />
    </Suspense>
  );
}

function SubmissionsView() {
  const isReviewer = useCan("submissions.review");
  const sent = useSearchParams().get("sent") === "1";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const query = isReviewer ? TABS.find((t) => t.id === tab)!.query : "";
  const { data, error, reload } = useApi<{ items: SubmissionJSON[]; pending: number }>(`/api/submissions?${query}`);
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  if (error && !data) return <ErrorPanel error={error} />;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{isReviewer ? "Review queue" : "Your suggestions"}</p>
          <h1 className="display text-3xl">Submissions</h1>
          <p className="text-sm text-muted">
            {isReviewer
              ? "New questions and edits suggested by users. Approving applies them to the catalog for everyone."
              : "New questions and edits you've suggested. An admin or editor approves them before they apply."}
          </p>
        </div>
        {!isReviewer ? (
          <Link href="/questions/new" className="btn-primary">
            + Suggest a question
          </Link>
        ) : null}
      </div>

      {sent ? <p className="rounded-xl bg-good/10 px-4 py-3 text-sm text-good">Sent for review. It shows up below.</p> : null}

      {isReviewer ? (
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)} className="chip">
              {t.label}
              {t.id === "pending" && data?.pending ? ` · ${data.pending}` : ""}
            </button>
          ))}
        </div>
      ) : null}

      {!data ? <Spinner className="min-h-[30vh]" /> : null}
      {data && data.items.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          {isReviewer && tab === "pending" ? "Nothing waiting for review." : "No submissions here yet."}
        </p>
      ) : null}
      {data?.items.map((s) => (
        <SubmissionCard
          key={s._id}
          s={s}
          canReview={isReviewer && s.status === "pending"}
          onDone={(msg) => {
            setToast(msg);
            reload();
          }}
        />
      ))}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function SubmissionCard({ s, canReview, onDone }: { s: SubmissionJSON; canReview: boolean; onDone: (msg: string) => void }) {
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields = (Object.keys(FIELD_LABEL) as (keyof CatalogFields)[]).filter((k) => k in s.data && s.data[k] !== undefined);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onDone(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <article className="card grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill ${STATUS_STYLE[s.status]}`}>{s.status}</span>
        <span className="text-sm font-medium">
          {s.kind === "new" ? (
            <>New question: {s.questionTitle}</>
          ) : (
            <>
              Edit to{" "}
              {s.questionId ? (
                <Link href={`/questions/${s.questionId}`} className="text-brass2 hover:underline">
                  {s.questionTitle}
                </Link>
              ) : (
                s.questionTitle
              )}
            </>
          )}
        </span>
        {s.kind === "new" && s.status === "approved" && s.questionId ? (
          <Link href={`/questions/${s.questionId}`} className="text-xs text-brass2 hover:underline">
            Open
          </Link>
        ) : null}
      </div>
      <p className="-mt-2 text-xs text-muted">
        {s.mine ? "You" : s.userName}
        {s.userEmail && !s.mine ? ` · ${s.userEmail}` : ""} · {formatDate(s.createdAt, true)}
      </p>

      <dl className="grid gap-1.5 text-sm">
        {fields.map((k) => (
          <div key={k} className="grid gap-x-3 sm:grid-cols-[8rem_1fr]">
            <dt className="text-xs text-muted sm:pt-0.5">{FIELD_LABEL[k]}</dt>
            <dd className="min-w-0 break-words">
              {s.kind === "edit" ? (
                <span className="block text-muted line-through decoration-warn/60">
                  <Value v={s.before[k]} />
                </span>
              ) : null}
              <span className="block">
                <Value v={s.data[k]} />
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {s.note ? (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className="text-xs text-muted">Note: </span>
          {s.note}
        </p>
      ) : null}
      {s.status !== "pending" && s.reviewNote ? (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className="text-xs text-muted">Admin: </span>
          {s.reviewNote}
        </p>
      ) : null}

      {canReview ? (
        <div className="grid gap-2 border-t border-line pt-3">
          <input
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Note to the user (optional, shown with the decision)"
            className="field"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              disabled={busy}
              onClick={() => run(() => send(`/api/submissions/${s._id}`, "PATCH", { action: "reject", reviewNote }), "Rejected")}
              className="btn border-warn/40 text-warn"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () => send(`/api/submissions/${s._id}`, "PATCH", { action: "approve", reviewNote }),
                  s.kind === "new" ? "Approved: added to the catalog" : "Approved: question updated",
                )
              }
              className="btn-primary"
            >
              Approve
            </button>
          </div>
        </div>
      ) : s.mine && s.status === "pending" ? (
        <div className="flex justify-end">
          <button
            disabled={busy}
            onClick={() => confirm("Withdraw this suggestion?") && run(() => send(`/api/submissions/${s._id}`, "DELETE"), "Withdrawn")}
            className="btn btn-sm"
          >
            Withdraw
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </article>
  );
}

function Value({ v }: { v: unknown }) {
  if (Array.isArray(v)) {
    if (!v.length) return <span className="text-muted">—</span>;
    const links = v.every((x) => /^https?:\/\//.test(String(x)));
    return links ? (
      <span className="grid">
        {v.map((x) => (
          <a key={String(x)} href={String(x)} target="_blank" rel="noreferrer" className="truncate text-brass2 hover:underline">
            {String(x)}
          </a>
        ))}
      </span>
    ) : (
      <>{v.join(", ")}</>
    );
  }
  const text = String(v ?? "");
  if (!text) return <span className="text-muted">—</span>;
  return /^https?:\/\//.test(text) ? (
    <a href={text} target="_blank" rel="noreferrer" className="text-brass2 hover:underline">
      {text}
    </a>
  ) : (
    <>{text}</>
  );
}
