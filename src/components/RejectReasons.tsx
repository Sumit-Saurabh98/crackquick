"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";

/** Settings: the one-click reasons reviewers reject suggestions with. Each change saves at once. */
export function RejectReasons() {
  const { data, error, reload } = useApi<{ items: string[] }>("/api/reject-reasons");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const items = data?.items ?? [];

  async function save(next: string[], message: string) {
    setBusy(true);
    setStatus("");
    try {
      await send("/api/reject-reasons", "PUT", { items: next });
      reload();
      setStatus(message);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-warn">{error}</p>;

  return (
    <div className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) void save([...items, draft.trim()], `Added “${draft.trim()}”.`).then(() => setDraft(""));
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New reason (e.g. Duplicate of a GFG problem)"
          className="field min-w-0 flex-1"
          maxLength={120}
        />
        <button disabled={busy || !draft.trim()} className="btn-primary">
          Add
        </button>
      </form>
      {items.length ? (
        <ul className="grid rounded-xl border border-line">
          {items.map((r, i) => (
            <li key={r} className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
              <span className="min-w-0 truncate">{r}</span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={busy || i === 0}
                  onClick={() => {
                    const next = [...items];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    void save(next, "Order saved.");
                  }}
                  className="btn btn-sm"
                  aria-label={`Move “${r}” up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(items.filter((x) => x !== r), `Removed “${r}”.`)}
                  className="btn btn-sm"
                  aria-label={`Remove “${r}”`}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No saved reasons; reviewers can still type a note.</p>
      )}
      {status ? <p className="text-xs text-muted">{status}</p> : null}
    </div>
  );
}
