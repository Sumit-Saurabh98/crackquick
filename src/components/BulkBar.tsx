"use client";

import { useState } from "react";
import { OptionSelect } from "@/components/OptionSelect";
import { send } from "@/lib/api";
import type { BulkAction } from "@/lib/bulk";
import { DIFFICULTIES } from "@/lib/constants";

const ACTIONS: { id: BulkAction; label: string; input: "pattern" | "difficulty" | "text" | null; placeholder?: string }[] = [
  { id: "setPattern", label: "Set pattern", input: "pattern" },
  { id: "setDifficulty", label: "Set difficulty", input: "difficulty" },
  { id: "addTopic", label: "Add topic", input: "text", placeholder: "Topic, e.g. Graphs" },
  { id: "removeTopic", label: "Remove topic", input: "text", placeholder: "Topic to remove" },
  { id: "addCompany", label: "Add company", input: "text", placeholder: "Company, e.g. Google" },
  { id: "removeCompany", label: "Remove company", input: "text", placeholder: "Company to remove" },
  { id: "retire", label: "Retire", input: null },
  { id: "restore", label: "Restore", input: null },
];

/**
 * Bulk edit for catalog editors. Targets the ticked rows, or, after "select all N matching",
 * everything the current filters match (sent as the filter query, resolved on the server).
 */
export function BulkBar({
  pageIds,
  selected,
  allMatching,
  total,
  query,
  onSelect,
  onDone,
}: {
  pageIds: string[];
  selected: Set<string>;
  allMatching: boolean;
  total: number;
  query: string;
  onSelect: (ids: Set<string>, allMatching: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [action, setAction] = useState<BulkAction>("setPattern");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conf = ACTIONS.find((a) => a.id === action)!;
  const count = allMatching ? total : selected.size;
  const pageAll = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  async function apply() {
    setError("");
    const target = allMatching ? { query } : { ids: [...selected] };
    setBusy(true);
    try {
      const { count: n } = await send<{ count: number }>("/api/questions/bulk", "POST", { ...target, preview: true });
      const what = conf.input ? `${conf.label.toLowerCase()} “${value || "none"}”` : conf.label.toLowerCase();
      if (!confirm(`${what[0].toUpperCase()}${what.slice(1)} on ${n} question${n === 1 ? "" : "s"}? Each change is recorded and can be reverted.`)) {
        setBusy(false);
        return;
      }
      const r = await send<{ matched: number; changed: number }>("/api/questions/bulk", "POST", { ...target, action, value });
      setValue("");
      onDone(r.changed === r.matched ? `Updated ${r.changed}` : `Updated ${r.changed} of ${r.matched} (the rest already matched)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card sticky top-[61px] z-10 grid gap-2 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pageAll}
            onChange={(e) => onSelect(e.target.checked ? new Set([...selected, ...pageIds]) : new Set(), false)}
            className="size-4 accent-[var(--brass)]"
          />
          {count ? `${count} selected` : "Select page"}
        </label>
        {pageAll && !allMatching && total > pageIds.length ? (
          <button type="button" onClick={() => onSelect(selected, true)} className="text-brass2 underline">
            Select all {total} matching
          </button>
        ) : null}
        {count ? (
          <button type="button" onClick={() => onSelect(new Set(), false)} className="text-xs text-muted hover:text-ink">
            Clear
          </button>
        ) : null}
      </div>
      {count ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value as BulkAction);
              setValue("");
            }}
            className="field"
            aria-label="Bulk action"
          >
            {ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {conf.input === "pattern" ? (
            <div className="min-w-[220px] flex-1">
              <OptionSelect kind="pattern" value={value} onChange={setValue} />
            </div>
          ) : conf.input === "difficulty" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="field" aria-label="Difficulty">
              <option value="">Pick…</option>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          ) : conf.input === "text" ? (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={conf.placeholder}
              className="field min-w-[200px] flex-1"
              aria-label="Value"
            />
          ) : null}
          <button
            onClick={apply}
            disabled={busy || ((conf.input === "text" || conf.input === "difficulty") && !value.trim())}
            className="btn-primary"
          >
            {busy ? "Working…" : `Apply to ${count}`}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}
