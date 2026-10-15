"use client";

import { useState } from "react";
import { send } from "@/lib/api";
import { CATEGORY_COLORS, MAX_CATEGORY_NAME, type CategoryColor, type CategoryJSON } from "@/lib/noteTypes";

export type CategoryData = { items: CategoryJSON[]; total: number; uncategorized: number };

/** "" = all notes, "none" = uncategorized, otherwise a category id. */
export type CategoryFilter = string;

function Dot({ color }: { color: CategoryColor }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[color] }} aria-hidden />;
}

function ColorPicker({ value, onChange }: { value: CategoryColor; onChange: (c: CategoryColor) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
      {(Object.keys(CATEGORY_COLORS) as CategoryColor[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={`size-5 rounded-full border-2 ${value === c ? "border-ink" : "border-transparent"}`}
          style={{ background: CATEGORY_COLORS[c] }}
        />
      ))}
    </div>
  );
}

/** Name + colour form, for adding and renaming. */
function CategoryEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; color: CategoryColor };
  submitLabel: string;
  onSubmit: (v: { name: string; color: CategoryColor }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-2 rounded-xl border border-line bg-bg p-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSubmit({ name, color });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
          setBusy(false);
        }
      }}
    >
      <input
        autoFocus
        required
        value={name}
        maxLength={MAX_CATEGORY_NAME}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder="Category name"
        className="field py-1.5"
      />
      <ColorPicker value={color} onChange={setColor} />
      {error ? <p className="text-xs text-warn">{error}</p> : null}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className="btn btn-sm">
          Cancel
        </button>
        <button disabled={busy} className="btn-primary btn-sm">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Category list with counts; add, rename, recolour and delete in place. */
export function CategoryPanel({
  data,
  selected,
  onSelect,
  onChanged,
  notify,
}: {
  data: CategoryData | null;
  selected: CategoryFilter;
  onSelect: (f: CategoryFilter) => void;
  onChanged: () => void;
  notify: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(cat: CategoryJSON) {
    const what = cat.count ? `Its ${cat.count} note${cat.count === 1 ? "" : "s"} will move to Uncategorized.` : "It has no notes.";
    if (!confirm(`Delete the category “${cat.name}”? ${what}`)) return;
    setError("");
    try {
      await send(`/api/notes/categories/${cat._id}`, "DELETE");
      if (selected === cat._id) onSelect("");
      notify("Category deleted");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const row = (key: string, label: React.ReactNode, count: number | undefined, dot?: CategoryColor) => (
    <button
      key={key}
      onClick={() => onSelect(key)}
      aria-current={selected === key ? "true" : undefined}
      className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
        selected === key ? "bg-brass/15 text-brass2" : "text-ink hover:bg-white/5"
      }`}
    >
      {dot ? <Dot color={dot} /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-muted">{count ?? ""}</span>
    </button>
  );

  return (
    <aside className="card grid content-start gap-1 p-3 lg:sticky lg:top-20">
      <p className="eyebrow px-2.5 pb-1">Categories</p>
      {row("", "All notes", data?.total)}
      {row("none", "Uncategorized", data?.uncategorized)}
      {data?.items.length ? <div className="my-1 border-t border-line" /> : null}
      {data?.items.map((cat) =>
        editing === cat._id ? (
          <CategoryEditor
            key={cat._id}
            initial={cat}
            submitLabel="Save"
            onCancel={() => setEditing(null)}
            onSubmit={async (v) => {
              await send(`/api/notes/categories/${cat._id}`, "PATCH", v);
              setEditing(null);
              notify("Category saved");
              onChanged();
            }}
          />
        ) : (
          <div key={cat._id} className="group flex items-center gap-0.5">
            {row(cat._id, cat.name, cat.count, cat.color)}
            <span className="flex shrink-0 gap-0.5 opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
              <button onClick={() => setEditing(cat._id)} title={`Rename ${cat.name}`} aria-label={`Rename ${cat.name}`} className="rounded-md px-1.5 py-1 text-xs text-muted hover:bg-white/10 hover:text-ink">
                ✎
              </button>
              <button onClick={() => remove(cat)} title={`Delete ${cat.name}`} aria-label={`Delete ${cat.name}`} className="rounded-md px-1.5 py-1 text-xs text-muted hover:bg-warn/15 hover:text-warn">
                ✕
              </button>
            </span>
          </div>
        ),
      )}
      <div className="mt-1">
        {adding ? (
          <CategoryEditor
            initial={{ name: "", color: "brass" }}
            submitLabel="Add"
            onCancel={() => setAdding(false)}
            onSubmit={async (v) => {
              const r = await send<{ item: CategoryJSON }>("/api/notes/categories", "POST", v);
              setAdding(false);
              notify("Category added");
              onChanged();
              onSelect(r.item._id);
            }}
          />
        ) : (
          <button onClick={() => setAdding(true)} className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-brass2 hover:bg-brass/10">
            + New category
          </button>
        )}
      </div>
      {error ? <p className="px-2.5 text-xs text-warn">{error}</p> : null}
    </aside>
  );
}

export { Dot as CategoryDot };
