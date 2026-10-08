"use client";

import { useCallback, useState } from "react";
import { AnnouncementCard } from "@/components/AnnouncementBanner";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useCan } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import type { AnnouncementJSON } from "@/lib/announcements";
import { dateKey, formatDate } from "@/lib/dates";
import { useApi } from "@/lib/useApi";

const STATE_STYLE: Record<AnnouncementJSON["state"], string> = {
  live: "bg-good/15 text-good",
  scheduled: "bg-brass/15 text-brass2",
  ended: "bg-white/5 text-muted",
};

type Draft = { message: string; tone: AnnouncementJSON["tone"]; linkUrl: string; linkLabel: string; startDate: string; endDate: string };

const empty = (): Draft => ({ message: "", tone: "new", linkUrl: "", linkLabel: "", startDate: dateKey(), endDate: "" });

/** The form's dates from a saved one: the end is stored as the next midnight, so show the day before. */
function toDraft(a: AnnouncementJSON): Draft {
  return {
    message: a.message,
    tone: a.tone,
    linkUrl: a.linkUrl,
    linkLabel: a.linkLabel,
    startDate: dateKey(new Date(a.startsAt)),
    endDate: a.endsAt ? dateKey(new Date(new Date(a.endsAt).getTime() - 1)) : "",
  };
}

export default function AnnouncementsPage() {
  if (!useCan("announcements.manage")) return <ErrorPanel error="You don't have permission to manage announcements." />;
  return <Announcements />;
}

function Announcements() {
  const { data, error, reload } = useApi<{ items: AnnouncementJSON[] }>("/api/announcements?all=1");
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (editing) await send(`/api/announcements/${editing}`, "PATCH", draft);
      else await send("/api/announcements", "POST", draft);
      setToast(editing ? "Saved" : draft.startDate > dateKey() ? "Scheduled" : "Posted: it's on everyone's Desk");
      setDraft(empty());
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      setToast(message);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <ErrorPanel error={error} />;
  const preview: AnnouncementJSON = {
    _id: "preview",
    ...draft,
    message: draft.message || "Your message appears here.",
    startsAt: "",
    endsAt: null,
    state: "live",
    createdByName: "",
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <p className="eyebrow">Everyone&apos;s Desk</p>
        <h1 className="display text-3xl">Announcements</h1>
        <p className="text-sm text-muted">A banner at the top of every learner&apos;s Desk while it&apos;s live. Each person can dismiss it.</p>
      </div>

      <form onSubmit={save} className="card grid gap-4 p-5">
        <h2 className="display text-xl">{editing ? "Edit announcement" : "New announcement"}</h2>
        <label className="grid gap-1 text-sm">
          Message
          <textarea
            required
            rows={2}
            maxLength={280}
            value={draft.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="New: 40 graph problems added, with videos."
            className="field"
          />
          <span className="text-right text-xs text-muted">{draft.message.length} / 280</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Kind
            <select value={draft.tone} onChange={(e) => set("tone", e.target.value as Draft["tone"])} className="field">
              <option value="new">New</option>
              <option value="info">Note</option>
              <option value="warning">Heads up</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Starts
            <input type="date" required value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} className="field" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>
              Last day <span className="text-xs text-muted">(optional)</span>
            </span>
            <input
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(e) => set("endDate", e.target.value)}
              className="field"
              title="The last day it's shown; leave empty to keep it up until you end it"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="grid gap-1 text-sm">
            Link <span className="-mt-1 text-xs text-muted">optional: https://… or a page here, e.g. /questions?pattern=Graphs</span>
            <input value={draft.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} className="field" inputMode="url" />
          </label>
          <label className="grid gap-1 text-sm">
            Link text
            <input
              value={draft.linkLabel}
              onChange={(e) => set("linkLabel", e.target.value)}
              maxLength={40}
              placeholder="Open"
              disabled={!draft.linkUrl}
              className="field"
            />
          </label>
        </div>
        <div className="grid gap-1">
          <p className="eyebrow">Preview</p>
          <AnnouncementCard a={preview} />
        </div>
        {formError ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{formError}</p> : null}
        <div className="flex justify-end gap-2">
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDraft(empty());
                setFormError("");
              }}
              className="btn"
            >
              Cancel
            </button>
          ) : null}
          <button disabled={busy} className="btn-primary">
            {editing ? "Save" : draft.startDate > dateKey() ? "Schedule" : "Post now"}
          </button>
        </div>
      </form>

      <section className="card grid gap-3 p-5">
        <h2 className="display text-xl">All announcements</h2>
        {!data ? <Spinner /> : null}
        {data && !data.items.length ? <p className="text-sm text-muted">None yet.</p> : null}
        {data?.items.map((a) => (
          <div key={a._id} className="grid gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className={`pill ${STATE_STYLE[a.state]}`}>{a.state}</span>
              <span>
                {formatDate(a.startsAt)}
                {a.endsAt ? ` → ${formatDate(new Date(new Date(a.endsAt).getTime() - 1))}` : " → no end date"}
                {a.createdByName ? ` · by ${a.createdByName}` : ""}
              </span>
              <span className="ml-auto flex gap-1.5">
                {a.state !== "ended" ? (
                  <button
                    onClick={() => {
                      setEditing(a._id);
                      setDraft(toDraft(a));
                      setFormError("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="btn btn-sm"
                  >
                    Edit
                  </button>
                ) : null}
                {a.state === "live" ? (
                  <button
                    disabled={busy}
                    onClick={() => act(() => send(`/api/announcements/${a._id}`, "PATCH", { endNow: true }), "Ended: it's off everyone's Desk")}
                    className="btn btn-sm"
                  >
                    End now
                  </button>
                ) : null}
                <button
                  disabled={busy}
                  onClick={() => confirm("Delete this announcement?") && act(() => send(`/api/announcements/${a._id}`, "DELETE"), "Deleted")}
                  className="btn btn-sm border-warn/40 text-warn"
                >
                  Delete
                </button>
              </span>
            </div>
            <AnnouncementCard a={a} />
          </div>
        ))}
      </section>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
