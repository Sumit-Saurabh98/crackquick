"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { send } from "@/lib/api";
import { CONFIDENCE_LABELS } from "@/lib/constants";
import { dateKey, formatDate } from "@/lib/dates";
import { intervalFor, nextStage, revisionState, type Outcome } from "@/lib/revision";
import type { QuestionJSON } from "@/lib/serialize";
import { useSettings } from "@/lib/useSettings";

export type AttemptResult = { item: QuestionJSON; kind: string };

type Grade = { outcome: Outcome; confidence: number };

const GRADES: (Grade & { key: string; label: string })[] = [
  { outcome: "blanked", confidence: 1, key: "b", label: "Blanked" },
  ...[1, 2, 3, 4, 5].map((n) => ({ outcome: "recalled" as const, confidence: n, key: String(n), label: String(n) })),
];

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/**
 * Optional minutes + one-click grade buttons (Blanked, 1-5). Clicking a grade saves.
 * With `keyboard`, keys b / 1-5 grade too.
 */
export function GradePanel({
  q,
  keyboard = false,
  onSaved,
}: {
  q: QuestionJSON;
  keyboard?: boolean;
  onSaved: (r: AttemptResult) => void;
}) {
  const { intervals } = useSettings();
  const [minutes, setMinutes] = useState("");
  const [hover, setHover] = useState<Grade | null>(null);
  const [backfill, setBackfill] = useState(false);
  const [solvedOn, setSolvedOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canBackfill = q.timesSolved === 0 && q.lapses === 0;
  const early = q.status === "done" && revisionState(q.nextRevisionAt) === "upcoming";

  async function submit(g: Grade) {
    if (saving) return;
    if (backfill && !solvedOn) {
      setError("Pick the date you solved it.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await send<AttemptResult>(`/api/questions/${q._id}/attempts`, "POST", {
        ...g,
        minutes: Number(minutes) || 0,
        solvedAt: backfill ? solvedOn : undefined,
      });
      onSaved(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  const onGradeKey = useEffectEvent((g: Grade) => submit(g));

  useEffect(() => {
    if (!keyboard) return;
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const g = GRADES.find((x) => x.key === e.key.toLowerCase());
      if (g) {
        e.preventDefault();
        onGradeKey(g);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard]);

  function preview(g: Grade) {
    return intervalFor(
      nextStage({ stage: q.revisionStage, confidence: g.confidence, outcome: g.outcome, early, intervals }),
      intervals,
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid w-32 gap-1 text-xs text-muted">
          Minutes spent
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="optional"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="field"
          />
        </label>
        {canBackfill ? (
          <div className="flex flex-wrap items-center gap-3 pb-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />
              I solved this earlier, on
            </label>
            {backfill ? (
              <input type="date" max={dateKey()} value={solvedOn} onChange={(e) => setSolvedOn(e.target.value)} className="field py-1" />
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs text-muted">
          {hover
            ? hover.outcome === "blanked"
              ? `Couldn't recall it: back in ${preview(hover)}d`
              : `${CONFIDENCE_LABELS[hover.confidence]} → next review in ${preview(hover)}d`
            : early
              ? `Not due until ${formatDate(q.nextRevisionAt)}: an early review won't push it further out.`
              : "How did it go? Low grades bring it back sooner."}
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g.key}
              type="button"
              disabled={saving}
              onClick={() => submit(g)}
              onMouseEnter={() => setHover(g)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(g)}
              onBlur={() => setHover(null)}
              title={g.outcome === "blanked" ? "Couldn't recall the approach" : CONFIDENCE_LABELS[g.confidence]}
              className={`flex flex-col items-center rounded-xl border px-1 py-2 transition disabled:opacity-50 ${
                g.outcome === "blanked"
                  ? "border-warn/40 text-warn hover:bg-warn/10"
                  : g.confidence >= 4
                    ? "border-good/40 text-good hover:bg-good/10"
                    : "border-line text-ink hover:border-brass/50"
              }`}
            >
              <span className={g.outcome === "blanked" ? "text-xs font-semibold" : "display text-xl"}>{g.label}</span>
              <span className="text-[10px] text-muted">{keyboard ? <kbd>{g.key.toUpperCase()}</kbd> : `${preview(g)}d`}</span>
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}
