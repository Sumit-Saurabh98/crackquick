"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { send } from "@/lib/api";
import { MAX_TITLE, type CategoryJSON, type NoteJSON } from "@/lib/noteTypes";
import { useApi } from "@/lib/useApi";
import { RichEditor, useNoteEditor } from "./RichEditor";

/** Writes a new note (no `note`) or edits one. Saving opens the note; ⌘S / Ctrl+S saves. */
export function NoteForm({ note, defaultCategory = "" }: { note?: NoteJSON; defaultCategory?: string }) {
  const router = useRouter();
  const categories = useApi<{ items: CategoryJSON[] }>("/api/notes/categories");
  const [title, setTitle] = useState(note?.title ?? "");
  const [categoryId, setCategoryId] = useState(note?.categoryId ?? defaultCategory);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ed = useNoteEditor(note?.content ?? null, () => setDirty(true));
  const back = note ? `/notes/${note._id}` : "/notes";

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (!ed.editor || busy) return;
    if (ed.uploading) return setError("Wait for the image to finish uploading.");
    setBusy(true);
    setError("");
    try {
      const body = { title, categoryId: categoryId || null, content: ed.editor.getJSON(), text: ed.editor.getText({ blockSeparator: "\n" }) };
      const r = note ? await send<{ item: NoteJSON }>(`/api/notes/${note._id}`, "PATCH", body) : await send<{ item: NoteJSON }>("/api/notes", "POST", body);
      setDirty(false);
      router.push(`/notes/${r.item._id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={back} className="text-sm text-muted hover:text-ink">
          ← {note ? "Back to note" : "All notes"}
        </Link>
        <span className="ml-auto flex items-center gap-2">
          {dirty ? <span className="text-xs text-muted">Unsaved changes</span> : null}
          <Link href={back} className="btn btn-sm">
            Cancel
          </Link>
          <button onClick={save} disabled={busy || !ed.editor} className="btn-primary btn-sm">
            {busy ? "Saving…" : note ? "Save" : "Publish"}
          </button>
        </span>
      </div>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        maxLength={MAX_TITLE}
        placeholder="Note title"
        aria-label="Title"
        autoFocus={!note}
        className="display w-full bg-transparent text-3xl text-brass2 outline-none placeholder:text-muted/60 sm:text-4xl"
      />
      <label className="flex items-center gap-2 text-sm text-muted">
        Category
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setDirty(true);
          }}
          className="field"
        >
          <option value="">Uncategorized</option>
          {categories.data?.items.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{error}</p> : null}
      <RichEditor note={ed} />
    </div>
  );
}
