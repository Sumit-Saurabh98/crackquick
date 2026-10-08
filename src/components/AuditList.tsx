"use client";

import Link from "next/link";
import { useState } from "react";
import { send } from "@/lib/api";
import type { AuditJSON } from "@/lib/audit";
import { formatDate } from "@/lib/dates";
import { FIELD_LABEL } from "@/lib/fieldLabels";

const ACTION_STYLE: Record<AuditJSON["action"], [string, string]> = {
  create: ["Added", "bg-good/15 text-good"],
  edit: ["Edited", "bg-brass/15 text-brass2"],
  retire: ["Retired", "bg-warn/10 text-warn"],
  restore: ["Restored", "bg-good/15 text-good"],
  delete: ["Deleted", "bg-warn/15 text-warn"],
};

const SOURCE_LABEL: Record<AuditJSON["source"], string> = {
  manual: "",
  import: "via import",
  submission: "via approved suggestion",
  bulk: "via bulk action",
  backfill: "via company backfill",
  revert: "revert",
};

/** Catalog change history. `showQuestion` adds the question's title (for the global feed). */
export function AuditList({
  items,
  showQuestion = false,
  onChanged,
}: {
  items: AuditJSON[];
  showQuestion?: boolean;
  onChanged: (message: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function revert(e: AuditJSON) {
    if (!confirm("Revert this change? The fields go back to their old values.")) return;
    setBusy(e._id);
    setError("");
    try {
      await send(`/api/audit/${e._id}/revert`, "POST");
      onChanged("Reverted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revert");
    } finally {
      setBusy("");
    }
  }

  if (!items.length) return <p className="text-sm text-muted">No changes recorded yet.</p>;

  return (
    <div className="grid gap-2">
      {error ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{error}</p> : null}
      <ol className="grid gap-2">
        {items.map((e) => {
          const [label, cls] = ACTION_STYLE[e.action];
          // A creation or deletion lists every field; only edits are worth spelling out in full.
          const detailed = e.action === "edit" || e.source === "revert";
          return (
            <li key={e._id} className="grid gap-1.5 border-l-2 border-line py-0.5 pl-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`pill ${cls}`}>{label}</span>
                {showQuestion ? (
                  e.action === "delete" ? (
                    <span className="font-medium">{e.questionTitle}</span>
                  ) : (
                    <Link href={`/questions/${e.questionId}`} className="font-medium hover:text-brass2">
                      {e.questionTitle}
                    </Link>
                  )
                ) : null}
                <span className="text-xs text-muted">
                  {[e.userName, SOURCE_LABEL[e.source], formatDate(e.at, true)].filter(Boolean).join(" · ")}
                </span>
                {e.revertedBy ? <span className="pill bg-white/5 text-muted">reverted</span> : null}
                {e.canRevert ? (
                  <button onClick={() => revert(e)} disabled={busy === e._id} className="btn btn-sm ml-auto">
                    {busy === e._id ? "Reverting…" : "Revert"}
                  </button>
                ) : null}
              </div>
              {detailed ? (
                <dl className="grid gap-0.5 text-xs">
                  {e.changes.map((c) => (
                    <div key={c.field} className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">{FIELD_LABEL[c.field] ?? c.field}:</dt>
                      <dd className="min-w-0 break-words">
                        <span className="text-muted line-through decoration-warn/60">{show(c.from)}</span> → {show(c.to)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : e.action === "retire" || e.action === "restore" ? null : (
                <p className="text-xs text-muted">{e.changes.map((c) => FIELD_LABEL[c.field] ?? c.field).join(", ")}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function show(v: unknown) {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  const s = String(v ?? "");
  return s || "—";
}
