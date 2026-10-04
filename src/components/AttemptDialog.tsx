"use client";

import { useEffect } from "react";
import { GradePanel, type AttemptResult } from "@/components/GradePanel";
import type { QuestionJSON } from "@/lib/serialize";

export function AttemptDialog({
  q,
  onClose,
  onSaved,
}: {
  q: QuestionJSON;
  onClose: () => void;
  onSaved: (r: AttemptResult) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Log attempt: ${q.title}`}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Log attempt</p>
            <h2 className="display mt-1 text-2xl">{q.title}</h2>
          </div>
          <button onClick={onClose} className="btn btn-sm" aria-label="Close">
            Esc
          </button>
        </div>
        <div className="mt-4">
          <GradePanel q={q} keyboard onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}
