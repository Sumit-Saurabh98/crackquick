"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { GradePanel, type AttemptResult } from "@/components/GradePanel";
import { Markdown } from "@/components/Markdown";
import { DifficultyPill, RevisionPill } from "@/components/Pills";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/dates";
import type { QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";

const MODES = [
  { id: "due", label: "Due & overdue", query: "revision=queue&sort=next" },
  { id: "progress", label: "In progress", query: "status=in_progress&sort=last" },
  { id: "weak", label: "Low confidence", query: "maxConfidence=2&sort=last" },
  { id: "starred", label: "Starred", query: "starred=1&sort=last" },
] as const;

type Result = { q: QuestionJSON; r: AttemptResult | null };

export default function ReviewPage() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("due");
  const [run, setRun] = useState(0);
  const query = MODES.find((m) => m.id === mode)!.query;
  const { data, error, reload } = useApi<{ items: QuestionJSON[]; total: number }>(`/api/questions?${query}&limit=200`);

  if (error && !data) return <ErrorPanel error={error} />;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <p className="eyebrow">Recall first, then peek</p>
        <h1 className="display text-3xl">Review session</h1>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className="chip">
            {m.label}
          </button>
        ))}
      </div>
      {data ? (
        <Session
          key={`${mode}-${run}-${data.items.map((q) => q._id).join()}`}
          items={data.items}
          onRestart={() => {
            setRun((n) => n + 1);
            reload();
          }}
        />
      ) : (
        <Spinner />
      )}
    </div>
  );
}

function Session({ items, onRestart }: { items: QuestionJSON[]; onRestart: () => void }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const q = items[index];

  function advance(r: AttemptResult | null) {
    setResults((xs) => [...xs, { q: items[index], r }]);
    setIndex((i) => i + 1);
    setRevealed(false);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (!q || el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
    if (e.key === " " && !revealed) {
      e.preventDefault();
      setRevealed(true);
    } else if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      advance(null);
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="display text-2xl text-good">Nothing here. Inbox zero.</p>
        <p className="mt-2 text-sm text-muted">Try another mode, or solve something new.</p>
        <Link href="/" className="btn mt-4 inline-block">
          Back to desk
        </Link>
      </div>
    );
  }

  if (!q) return <Summary results={results} onRestart={onRestart} />;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>
          Card {index + 1} / {items.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-brass" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
        <button onClick={() => advance(null)} className="btn btn-sm">
          Skip <kbd>S</kbd>
        </button>
      </div>

      <section className="card grid gap-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyPill value={q.difficulty} />
            <RevisionPill q={q} />
          </div>
          <h2 className="display mt-2 text-3xl">{q.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {[
              revealed ? [q.pattern, ...q.topics].filter(Boolean).join(", ") : "pattern & topics hidden until you reveal",
              q.lastSolvedAt ? `last solved ${formatDate(q.lastSolvedAt)}` : "",
              q.timesSolved ? `${q.timesSolved}× · last confidence ${q.confidence}/5` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {q.platformUrl ? (
            <a href={q.platformUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
              Re-solve on {q.platform} ↗
            </a>
          ) : null}
          {revealed && q.videoUrl ? (
            <a href={q.videoUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
              Video ↗
            </a>
          ) : null}
          <Link href={`/questions/${q._id}`} target="_blank" className="btn btn-sm">
            Details ↗
          </Link>
        </div>

        <div className="rounded-xl border border-dashed border-line p-4">
          {revealed ? (
            q.notes ? (
              <Markdown>{q.notes}</Markdown>
            ) : (
              <p className="text-sm text-muted">No notes for this one. Add some after grading.</p>
            )
          ) : (
            <div className="grid justify-items-center gap-2 py-4 text-center">
              <p className="text-sm text-muted">
                Say the approach out loud first: pattern, key trick, complexity. Then check.
              </p>
              <button onClick={() => setRevealed(true)} className="btn">
                Reveal notes <kbd>Space</kbd>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card p-5">
        <GradePanel key={q._id} q={q} keyboard onSaved={(r) => advance(r)} />
      </section>
    </div>
  );
}

function Summary({ results, onRestart }: { results: Result[]; onRestart: () => void }) {
  const graded = results.filter((x) => x.r);
  const blanks = graded.filter((x) => x.r?.kind === "failed_recall").length;
  return (
    <div className="card grid gap-4 p-6">
      <div>
        <p className="eyebrow">Session complete</p>
        <h2 className="display text-3xl text-brass2">
          {graded.length} reviewed
        </h2>
        <p className="text-sm text-muted">
          {blanks} blanked · {results.length - graded.length} skipped
        </p>
      </div>
      <ul className="grid gap-1 text-sm">
        {results.map(({ q, r }) => (
          <li key={q._id} className="flex flex-wrap justify-between gap-2 border-b border-line py-1.5 last:border-0">
            <Link href={`/questions/${q._id}`} className="hover:text-brass2">
              {q.title}
            </Link>
            <span className={r?.kind === "failed_recall" ? "text-warn" : "text-muted"}>
              {r
                ? `${r.kind === "failed_recall" ? "blanked" : `conf ${r.item.confidence}`} → ${formatDate(r.item.nextRevisionAt)}`
                : "skipped"}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Link href="/" className="btn-primary">
          Back to desk
        </Link>
        <button onClick={onRestart} className="btn">
          Reload queue
        </button>
      </div>
    </div>
  );
}
