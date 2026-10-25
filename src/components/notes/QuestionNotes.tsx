"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { send } from "@/lib/api";
import type { QuestionJSON } from "@/lib/serialize";
import { RichContent } from "./RichContent";
import { RichEditor, useNoteEditor } from "./RichEditor";

type Notes = Pick<QuestionJSON, "notes" | "notesDoc">;

/** Whether the question has notes to show. */
export function hasNotes(q: Notes) {
  return q.notesDoc ? true : Boolean(q.notes.trim());
}

/** A question's notes, read-only: the rich-editor ones, or the older Markdown ones. */
export function QuestionNotesView({ q }: { q: Notes }) {
  return q.notesDoc ? <RichContent content={q.notesDoc} /> : <Markdown>{q.notes}</Markdown>;
}

/**
 * The Notes card on a question: read view plus the Notes-section editor. Markdown notes open in the
 * editor converted from their rendered HTML; the Markdown itself is kept in the database untouched.
 */
export function QuestionNotes({ q, onSaved }: { q: QuestionJSON; onSaved: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const view = useRef<HTMLDivElement>(null);

  return (
    <section className="card question-notes p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="display text-xl">Notes</h2>
        {editing === null ? (
          <button onClick={() => setEditing(q.notesDoc ? "" : (view.current?.innerHTML ?? ""))} className="btn btn-sm">
            Edit notes
          </button>
        ) : null}
      </div>
      {editing !== null ? (
        <Editing
          q={q}
          html={editing}
          onDone={(saved) => {
            setEditing(null);
            if (saved) onSaved();
          }}
        />
      ) : hasNotes(q) ? (
        <div ref={view} className="mt-3">
          <QuestionNotesView q={q} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No notes yet. Write the approach, the trick, pitfalls and complexity.</p>
      )}
    </section>
  );
}

function Editing({ q, html, onDone }: { q: QuestionJSON; html: string; onDone: (saved: boolean) => void }) {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ed = useNoteEditor(q.notesDoc ?? (html.trim() ? html : null), () => setDirty(true));

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
      await send(`/api/questions/${q._id}`, "PATCH", {
        notesDoc: ed.editor.getJSON(),
        notesText: ed.editor.getText({ blockSeparator: "\n" }),
      });
      setDirty(false);
      onDone(true);
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
    <div className="mt-3 grid gap-3">
      {error ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{error}</p> : null}
      <RichEditor note={ed} />
      <div className="flex items-center justify-end gap-2">
        {dirty ? <span className="mr-auto text-xs text-muted">Unsaved changes</span> : null}
        <button onClick={() => onDone(false)} className="btn btn-sm">
          Cancel
        </button>
        <button onClick={save} disabled={busy || !ed.editor} className="btn-primary btn-sm">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
