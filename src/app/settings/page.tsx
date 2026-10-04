"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingsJSON } from "@/app/api/settings/route";
import { ErrorPanel } from "@/components/ErrorPanel";
import { send } from "@/lib/api";
import { DEFAULT_REVISION_INTERVALS, DEFAULT_TIMEZONE } from "@/lib/constants";
import { dateKey, setTimezone, timezoneLabel } from "@/lib/dates";
import type { Facets } from "@/lib/queries";
import { useApi } from "@/lib/useApi";

export default function SettingsPage() {
  const { data, error } = useApi<SettingsJSON>("/api/settings");
  if (error && !data) return <ErrorPanel error={error} />;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <h1 className="display text-3xl">Settings</h1>
      {data ? <SettingsForm initial={data} /> : <p className="text-muted">Loading…</p>}
      <LibraryTools />
    </div>
  );
}

function SettingsForm({ initial }: { initial: SettingsJSON }) {
  const facets = useApi<Facets>("/api/meta").data;
  const router = useRouter();
  const [timezone, setTz] = useState(initial.timezone);
  const [date, setDate] = useState(initial.interviewDate ? dateKey(new Date(initial.interviewDate)) : "");
  const [list, setList] = useState(initial.targetList);
  const [intervals, setIntervals] = useState(initial.intervals.join(", "));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const saved = await send<SettingsJSON>("/api/settings", "PUT", {
        interviewDate: date || null,
        targetList: list,
        intervals,
        timezone,
      });
      setIntervals(saved.intervals.join(", "));
      setTimezone(saved.timezone);
      router.refresh();
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card grid gap-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Interview date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
        <label className="grid gap-1 text-sm">
          Target list
          <select value={list} onChange={(e) => setList(e.target.value)} className="field">
            <option value="">All questions</option>
            {(facets?.sourceLists ?? []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted sm:col-span-2">
          With a date set, the Desk shows days left and how many questions a day you need to finish the target list.
        </p>
      </div>

      <label className="grid gap-1 text-sm">
        Revision intervals (days)
        <input
          value={intervals}
          onChange={(e) => setIntervals(e.target.value)}
          className="field font-mono"
          placeholder={DEFAULT_REVISION_INTERVALS.join(", ")}
        />
        <span className="text-xs text-muted">
          Each good recall moves a question one step along this list; a weak one moves it back, a blank restarts it.
          Default: {DEFAULT_REVISION_INTERVALS.join(", ")}. Applies to future reviews.
        </span>
      </label>

      <label className="grid gap-1 text-sm">
        Timezone
        <select value={timezone} onChange={(e) => setTz(e.target.value)} className="field">
          {timezoneOptions(timezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz === DEFAULT_TIMEZONE ? `${tz} · India (IST)` : tz}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">
          {timezoneLabel(timezone)}. Decides when a day starts for “due today”, streaks and all shown times.
        </span>
      </label>

      <div className="flex items-center justify-end gap-3">
        {status ? <span className="text-sm text-muted">{status}</span> : null}
        <button disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function LibraryTools() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function importBody(body: unknown) {
    setBusy(true);
    setStatus("");
    try {
      const r = await send<{ imported: number; skipped: number }>("/api/import", "POST", body);
      setStatus(`Imported ${r.imported}, skipped ${r.skipped} duplicates.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      await importBody(Array.isArray(json) ? { questions: json } : json);
    } catch {
      setStatus("That file isn't valid JSON.");
    }
  }

  return (
    <section className="card grid gap-4 p-5">
      <h2 className="display text-xl">Library</h2>
      <div className="grid gap-3">
        <Row title="Import from LeetCode / GFG" hint="By problem number, range, link or name, with difficulty and topics filled in.">
          <Link href="/questions/new" className="btn">
            Open
          </Link>
        </Row>
        <Row
          title="Import JSON"
          hint="An array of questions ({ title, platformUrl, difficulty, topics, … }) or a CrackQuick export. Imports questions only, not history."
        >
          <label className={`btn cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
            Choose file
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </Row>
        <Row
          title="Fill missing company tags"
          hint="Adds companies to LeetCode / GFG questions that have none, e.g. ones imported earlier."
        >
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                const r = await send<{ checked: number; updated: number }>("/api/companies/backfill", "POST");
                setStatus(`Updated ${r.updated} of ${r.checked} questions without company tags.`);
              } catch (e) {
                setStatus(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(false);
              }
            }}
            className="btn"
          >
            Fill
          </button>
        </Row>
        <Row title="Export backup" hint="Everything (questions, attempts, settings) as one JSON file.">
          <a href="/api/export" download className="btn">
            Download
          </a>
        </Row>
      </div>
      {status ? <p className="text-sm text-brass2">{status}</p> : null}
    </section>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** Every IANA timezone the browser knows, with IST first. */
function timezoneOptions(current: string) {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([DEFAULT_TIMEZONE, current, ...all])];
}
