"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { parseYouTube, type Playlist } from "@/lib/youtube";

type Draft = { name: string; url: string };
const EMPTY: Draft = { name: "", url: "" };

/**
 * Add / edit / delete / reorder the YouTube playlists shown in the music dock. Each action changes
 * one playlist on the server and shows the list it returns, so this view is never the source of truth.
 */
export function PlaylistSettings() {
  const router = useRouter();
  const { data, error } = useApi<{ items: Playlist[] }>("/api/playlists");
  const [fresh, setFresh] = useState<Playlist[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const items = fresh ?? data?.items ?? null;

  async function run(call: () => Promise<{ items: Playlist[] }>, message: string) {
    setBusy(true);
    setStatus("");
    try {
      const r = await call();
      setFresh(r.items);
      setStatus(message);
      router.refresh(); // the music dock reads playlists from the layout
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !parseYouTube(draft.url)) {
      setStatus("Give it a name and a YouTube video or playlist link.");
      return;
    }
    const ok = editing
      ? await run(() => send(`/api/playlists/${editing}`, "PATCH", draft), "Saved.")
      : await run(() => send("/api/playlists", "POST", draft), `Added “${draft.name.trim()}”.`);
    if (ok) {
      setDraft(EMPTY);
      setEditing(null);
    }
  }

  if (error && !items) return <p className="text-sm text-warn">{error}</p>;
  if (!items) return <Spinner className="min-h-[10vh]" />;

  return (
    <div className="grid gap-3">
      <form onSubmit={submitDraft} className="grid gap-2 sm:grid-cols-[1fr_1.6fr_auto]">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Name, e.g. Bollywood 90's"
          className="field"
          aria-label="Playlist name"
        />
        <input
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          placeholder="YouTube playlist or mix link"
          className="field"
          inputMode="url"
          aria-label="YouTube link"
        />
        <div className="flex gap-2">
          <button disabled={busy} className="btn-primary">
            {editing ? "Save" : "Add"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDraft(EMPTY);
              }}
              className="btn"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {status ? <p className="text-sm text-brass2">{status}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted">No playlists yet. Paste a YouTube playlist or mix link above.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.name}</p>
                <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted hover:text-brass2">
                  {p.url}
                </a>
              </div>
              <button
                type="button"
                disabled={busy || i === 0}
                onClick={() => run(() => send(`/api/playlists/${p.id}/move`, "POST", { dir: -1 }), "Order saved.")}
                className="btn btn-sm"
                aria-label={`Move ${p.name} up`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={busy || i === items.length - 1}
                onClick={() => run(() => send(`/api/playlists/${p.id}/move`, "POST", { dir: 1 }), "Order saved.")}
                className="btn btn-sm"
                aria-label={`Move ${p.name} down`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(p.id);
                  setDraft({ name: p.name, url: p.url });
                }}
                className="btn btn-sm"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Delete playlist “${p.name}”?`)) {
                    void run(() => send(`/api/playlists/${p.id}`, "DELETE"), `Deleted “${p.name}”.`);
                  }
                }}
                className="btn btn-sm border-warn/40 text-warn"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
