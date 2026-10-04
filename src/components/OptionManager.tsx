"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import type { OptionJSON, OptionKind } from "@/lib/options";
import { useApi } from "@/lib/useApi";

const LABELS: Record<OptionKind, { one: string; many: string; example: string }> = {
  platform: { one: "platform", many: "Platforms", example: "e.g. LeetCode, Codeforces" },
  pattern: { one: "pattern", many: "Patterns", example: "e.g. Two pointers, Sliding window" },
};

export type OptionChange = { type: "add"; name: string } | { type: "rename"; from: string; to: string } | { type: "delete"; name: string };

/** Add / rename / delete the values of one managed dropdown, with how many questions use each. */
export function OptionManager({ kind, onChanged }: { kind: OptionKind; onChanged?: (change: OptionChange) => void }) {
  const { data, error, reload } = useApi<{ items: OptionJSON[] }>(`/api/options?kind=${kind}`);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const label = LABELS[kind];

  async function run(fn: () => Promise<string | void>, change: OptionChange) {
    setBusy(true);
    setMessage("");
    try {
      const msg = await fn();
      if (msg) setMessage(msg);
      reload();
      onChanged?.(change);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="grid gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation(); // may render inside the question form (via a portal); don't submit that
          if (!newName.trim()) return;
          run(
            async () => {
              await send("/api/options", "POST", { kind, name: newName });
              setNewName("");
            },
            { type: "add", name: newName.trim() },
          );
        }}
        className="flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`New ${label.one} (${label.example})`}
          className="field flex-1"
          aria-label={`New ${label.one}`}
        />
        <button disabled={busy || !newName.trim()} className="btn-primary">
          Add
        </button>
      </form>

      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {message ? <p className="text-sm text-brass2">{message}</p> : null}

      {data && items.length === 0 ? (
        <p className="text-sm text-muted">No {label.many.toLowerCase()} yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((o) => (
            <li key={o._id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing?.id === o._id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const to = editing.name.trim().replace(/\s+/g, " ");
                    run(
                      async () => {
                        const r = await send<{ updated: number }>(`/api/options/${o._id}`, "PATCH", { name: to });
                        setEditing(null);
                        return r.updated ? `Renamed on ${r.updated} question${r.updated === 1 ? "" : "s"}.` : "";
                      },
                      { type: "rename", from: o.name, to },
                    );
                  }}
                >
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ id: o._id, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                    className="field flex-1 py-1"
                    aria-label={`Rename ${o.name}`}
                  />
                  <button disabled={busy} className="btn-primary btn-sm">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="btn btn-sm">
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{o.name}</span>
                  <span className="text-xs text-muted">
                    {o.count} question{o.count === 1 ? "" : "s"}
                  </span>
                  <button type="button" onClick={() => setEditing({ id: o._id, name: o.name })} className="btn btn-sm">
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const warn = o.count
                        ? `\n\n${o.count} question${o.count === 1 ? "" : "s"} will have no ${label.one}.`
                        : "";
                      if (!confirm(`Delete ${label.one} "${o.name}"?${warn}`)) return;
                      run(
                        async () => {
                          const r = await send<{ cleared: number }>(`/api/options/${o._id}`, "DELETE");
                          return `Deleted "${o.name}"${r.cleared ? `, cleared from ${r.cleared} question${r.cleared === 1 ? "" : "s"}` : ""}.`;
                        },
                        { type: "delete", name: o.name },
                      );
                    }}
                    className="btn btn-sm border-warn/40 text-warn"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { LABELS as OPTION_LABELS };
