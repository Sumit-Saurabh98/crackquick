"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { OptionManager, OPTION_LABELS, type OptionChange } from "@/components/OptionManager";
import { send } from "@/lib/api";
import type { OptionJSON, OptionKind } from "@/lib/options";
import { useApi } from "@/lib/useApi";

const ADD_NEW = "__add_new__";

/**
 * Dropdown of a managed list (platforms / patterns) with "+ Add new…" inline and a Manage dialog
 * for rename / delete.
 */
export function OptionSelect({
  kind,
  value,
  onChange,
  id,
}: {
  kind: OptionKind;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const { data, reload } = useApi<{ items: OptionJSON[] }>(`/api/options?kind=${kind}`);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState("");
  const label = OPTION_LABELS[kind];

  const names = (data?.items ?? []).map((o) => o.name);
  // A value not in the list yet (e.g. detected from a pasted link) is still selectable; it's added on save.
  const pending = value && !names.some((n) => n.toLowerCase() === value.toLowerCase()) ? value : "";

  async function add() {
    if (!newName.trim()) return;
    setError("");
    try {
      const { item } = await send<{ item: OptionJSON }>("/api/options", "POST", { kind, name: newName });
      reload();
      onChange(item.name);
      setAdding(false);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add");
    }
  }

  return (
    <div className="grid gap-1.5">
      {adding ? (
        <div className="flex gap-2">
          <input
            id={id}
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              } else if (e.key === "Escape") setAdding(false);
            }}
            placeholder={`New ${label.one} (${label.example})`}
            className="field min-w-0 flex-1"
          />
          <button type="button" onClick={add} disabled={!newName.trim()} className="btn-primary btn-sm">
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="btn btn-sm">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            id={id}
            value={value}
            onChange={(e) => (e.target.value === ADD_NEW ? setAdding(true) : onChange(e.target.value))}
            className="field min-w-0 flex-1"
          >
            <option value="">— none —</option>
            {pending ? <option value={pending}>{pending} (new)</option> : null}
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={ADD_NEW}>+ Add new {label.one}…</option>
          </select>
          <button type="button" onClick={() => setManaging(true)} className="btn btn-sm" title={`Rename or delete ${label.many.toLowerCase()}`}>
            Manage
          </button>
        </div>
      )}
      {error ? <span className="text-xs text-warn">{error}</span> : null}
      {managing ? (
        <ManageDialog
          kind={kind}
          onChanged={(c) => {
            // Keep the form's selection in step with a rename / delete of the selected value.
            const same = (n: string) => n.toLowerCase() === value.toLowerCase();
            if (c.type === "rename" && same(c.from)) onChange(c.to);
            if (c.type === "delete" && same(c.name)) onChange("");
          }}
          onClose={() => {
            setManaging(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function ManageDialog({
  kind,
  onChanged,
  onClose,
}: {
  kind: OptionKind;
  onChanged: (c: OptionChange) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Portal: this opens from inside the question <form>, and forms can't nest.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Manage ${OPTION_LABELS[kind].many}`}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">{OPTION_LABELS[kind].many}</h2>
          <button type="button" onClick={onClose} className="btn btn-sm">
            Done
          </button>
        </div>
        <OptionManager kind={kind} onChanged={onChanged} />
      </div>
    </div>,
    document.body,
  );
}
