"use client";

import Link from "next/link";
import { OptionSelect } from "@/components/OptionSelect";
import { useCan } from "@/components/ViewerProvider";
import { useRef, useState } from "react";
import { send } from "@/lib/api";
import { CONFIDENCE_LABELS, DIFFICULTIES } from "@/lib/constants";
import { dateKey } from "@/lib/dates";
import type { FoundProblem } from "@/lib/platforms";
import { parseProblemUrl } from "@/lib/problemUrl";
import type { Facets } from "@/lib/queries";
import type { QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";


export type QuestionFormMode = "create" | "edit" | "suggest-new" | "suggest-edit";

const SUBMIT_LABEL: Record<QuestionFormMode, string> = {
  create: "Create question",
  edit: "Save changes",
  "suggest-new": "Send for review",
  "suggest-edit": "Send for review",
};

/**
 * Catalog fields of a question.
 * - `create` / `edit` (admin): writes the catalog directly. Create can also star it, start it,
 *   or record an earlier solve for the admin's own progress.
 * - `suggest-new` / `suggest-edit` (users): sends a submission for an admin to approve.
 */
export function QuestionForm({
  mode,
  initial,
  onSaved,
}: {
  mode: QuestionFormMode;
  initial?: QuestionJSON;
  /** The saved question for create / edit; nothing for suggestions. */
  onSaved: (item?: QuestionJSON) => void;
}) {
  const facets = useApi<Facets>("/api/meta").data;
  const [form, setForm] = useState(() => ({
    title: initial?.title ?? "",
    platform: initial?.platform ?? "",
    platformUrl: initial?.platformUrl ?? "",
    externalId: initial?.externalId ?? "",
    difficulty: initial?.difficulty ?? ("Medium" as QuestionJSON["difficulty"]),
    pattern: initial?.pattern ?? "",
    status: "todo" as "todo" | "in_progress",
    isStarred: false,
  }));
  const [note, setNote] = useState("");
  const [topics, setTopics] = useState((initial?.topics ?? []).join(", "));
  const [companies, setCompanies] = useState((initial?.companies ?? []).join(", "));
  const [videos, setVideos] = useState(() => (initial?.videoUrls.length ? initial.videoUrls : [""]));
  const [solvedBefore, setSolvedBefore] = useState(false);
  const [solvedOn, setSolvedOn] = useState("");
  const [solvedConf, setSolvedConf] = useState(3);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchState, setFetchState] = useState<{ text: string; existingId?: string | null }>({ text: "" });
  const lookupSeq = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggesting = mode === "suggest-new" || mode === "suggest-edit";
  // Status / star / "already solved" go to the creator's own progress; admins don't practise.
  const practises = useCan("practice.track");
  const personalExtras = mode === "create" && practises;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onUrl(url: string) {
    set("platformUrl", url);
    const parsed = parseProblemUrl(url);
    if (!parsed) return;
    setForm((f) => ({
      ...f,
      platformUrl: url,
      platform: parsed.platform,
      title: f.title || parsed.title,
    }));
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    // Fill details from LeetCode / GFG when adding or suggesting (not when editing an existing one).
    if ((mode === "create" || mode === "suggest-new") && parsed.slug && (parsed.platform === "LeetCode" || parsed.platform === "GeeksforGeeks")) {
      const key = parsed.platform === "LeetCode" ? "leetcode" : "gfg";
      // Debounced so typing a link doesn't fire a lookup per keystroke.
      lookupTimer.current = setTimeout(() => void autofill(url, key, parsed.title), 500);
    }
  }

  /** Pulls real difficulty / topics / companies from the platform, filling only fields still blank. */
  async function autofill(url: string, platform: "leetcode" | "gfg", guessedTitle: string) {
    const seq = ++lookupSeq.current;
    setFetchState({ text: "Fetching details…" });
    try {
      const r = await send<{ items: (FoundProblem & { existingId: string | null })[] }>("/api/lookup", "POST", {
        platform,
        input: url,
      });
      if (seq !== lookupSeq.current) return;
      const p = r.items[0];
      if (!p) {
        setFetchState({ text: "Couldn't find that problem; fill the details in yourself." });
        return;
      }
      setForm((f) => ({
        ...f,
        title: !f.title || f.title === guessedTitle ? p.title : f.title,
        difficulty: p.difficulty,
        externalId: p.externalId,
      }));
      setVideos((v) => (v.some((u) => u.trim()) ? v : [p.videoUrl]));
      setTopics((t) => t || p.topics.join(", "));
      setCompanies((c) => c || p.companies.join(", "));
      setFetchState({
        text: `Filled from ${p.platform} #${p.externalId}${p.paidOnly ? " (premium)" : ""}.`,
        existingId: p.existingId,
      });
    } catch (err) {
      if (seq === lookupSeq.current) setFetchState({ text: err instanceof Error ? err.message : "Lookup failed" });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (solvedBefore && !solvedOn) {
      setError("Pick the date you solved it.");
      return;
    }
    setSaving(true);
    setError("");
    const { status, isStarred, ...catalog } = form;
    const payload: Record<string, unknown> = { ...catalog, topics, companies, videoUrls: videos };
    try {
      if (mode === "create") {
        if (solvedBefore) payload.backfill = { solvedAt: solvedOn, confidence: solvedConf };
        const { item } = await send<{ item: QuestionJSON }>("/api/questions", "POST", { ...payload, status, isStarred });
        onSaved(item);
      } else if (mode === "edit") {
        const { item } = await send<{ item: QuestionJSON }>(`/api/questions/${initial!._id}`, "PATCH", payload);
        onSaved(item);
      } else {
        await send("/api/submissions", "POST", {
          ...payload,
          kind: mode === "suggest-edit" ? "edit" : "new",
          questionId: initial?._id,
          note,
        });
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-4 p-5">
      <label className="grid gap-1 text-sm">
        Problem link
        <input
          value={form.platformUrl}
          onChange={(e) => onUrl(e.target.value)}
          className="field"
          placeholder="Paste https://leetcode.com/problems/... to auto-fill the title"
          inputMode="url"
        />
        {fetchState.text ? (
          <span className="text-xs text-muted">
            {fetchState.text}
            {fetchState.existingId ? (
              <>
                {" "}
                <Link href={`/questions/${fetchState.existingId}`} className="text-warn underline">
                  Already in the catalog
                </Link>
              </>
            ) : null}
          </span>
        ) : null}
      </label>
      <label className="grid gap-1 text-sm">
        Title
        <input required value={form.title} onChange={(e) => set("title", e.target.value)} className="field" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1 text-sm">
          <label htmlFor="q-platform">Platform</label>
          <OptionSelect id="q-platform" kind="platform" value={form.platform} onChange={(v) => set("platform", v)} />
        </div>
        <div className="grid content-start gap-1 text-sm">
          <label htmlFor="q-pattern">Pattern</label>
          <OptionSelect id="q-pattern" kind="pattern" value={form.pattern} onChange={(v) => set("pattern", v)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Difficulty
          <select
            value={form.difficulty}
            onChange={(e) => set("difficulty", e.target.value as QuestionJSON["difficulty"])}
            className="field"
          >
            {DIFFICULTIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {personalExtras ? (
          <label className="grid gap-1 text-sm">
            Your status
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as "todo" | "in_progress")}
              className="field"
            >
              <option value="todo">todo</option>
              <option value="in_progress">in progress</option>
            </select>
          </label>
        ) : null}
      </div>
      {personalExtras ? (
        <p className="-mt-2 text-xs text-muted">To mark it done, log an attempt (or tick “already solved” below).</p>
      ) : null}
      <div className="grid gap-1 text-sm">
        Video links
        {videos.map((url, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setVideos((v) => v.map((u, j) => (j === i ? e.target.value : u)))}
              className="field flex-1"
              placeholder="https://youtube.com/..."
              inputMode="url"
              aria-label={`Video link ${i + 1}`}
            />
            {videos.length > 1 ? (
              <button
                type="button"
                onClick={() => setVideos((v) => v.filter((_, j) => j !== i))}
                className="btn btn-sm"
                aria-label={`Remove video link ${i + 1}`}
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" onClick={() => setVideos((v) => [...v, ""])} className="btn btn-sm justify-self-start">
          + Add another video
        </button>
      </div>
      <label className="grid gap-1 text-sm">
        Topics <span className="text-xs text-muted">comma separated{facets?.topics.length ? ` · existing: ${facets.topics.slice(0, 12).join(", ")}` : ""}</span>
        <input value={topics} onChange={(e) => setTopics(e.target.value)} className="field" placeholder="Arrays, Hashing" />
      </label>
      <label className="grid gap-1 text-sm">
        Companies <span className="text-xs text-muted">comma separated</span>
        <input value={companies} onChange={(e) => setCompanies(e.target.value)} className="field" placeholder="Google, Amazon" />
      </label>
      {suggesting ? (
        <label className="grid gap-1 text-sm">
          Note for the admin <span className="text-xs text-muted">optional: why this change, where it&apos;s from</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
        </label>
      ) : null}
      {personalExtras ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isStarred} onChange={(e) => set("isStarred", e.target.checked)} />
          Star this (weak / must-revise)
        </label>
      ) : null}

      {personalExtras ? (
        <fieldset className="grid gap-3 rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={solvedBefore} onChange={(e) => setSolvedBefore(e.target.checked)} />
            I&apos;ve already solved this before
          </label>
          {solvedBefore ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted">
                Roughly when
                <input type="date" max={dateKey()} value={solvedOn} onChange={(e) => setSolvedOn(e.target.value)} className="field" />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                How well do you know it now?
                <select value={solvedConf} onChange={(e) => setSolvedConf(Number(e.target.value))} className="field">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {CONFIDENCE_LABELS[n]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted sm:col-span-2">
                Scheduled from that date, so an old solve goes straight into your review queue. No XP for backfills.
              </p>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {error ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{error}</p> : null}
      <div className="flex justify-end">
        <button disabled={saving} className="btn-primary">
          {saving ? "Saving…" : SUBMIT_LABEL[mode]}
        </button>
      </div>
    </form>
  );
}
