"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { send } from "@/lib/api";
import { CONFIDENCE_LABELS, DIFFICULTIES } from "@/lib/constants";
import { dateKey } from "@/lib/dates";
import type { FoundProblem } from "@/lib/platforms";
import { KNOWN_PLATFORMS, parseProblemUrl } from "@/lib/problemUrl";
import type { Facets } from "@/lib/queries";
import type { QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";


const EMPTY = {
  title: "",
  platform: "",
  platformUrl: "",
  externalId: "",
  videoUrl: "",
  notes: "",
  difficulty: "Medium" as QuestionJSON["difficulty"],
  status: "todo" as QuestionJSON["status"],
  sourceList: "",
  isStarred: false,
};

export function QuestionForm({
  initial,
  onSaved,
}: {
  initial?: QuestionJSON;
  onSaved: (item: QuestionJSON) => void;
}) {
  const facets = useApi<Facets>("/api/meta").data;
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(initial ?? {}) }));
  const [topics, setTopics] = useState((initial?.topics ?? []).join(", "));
  const [companies, setCompanies] = useState((initial?.companies ?? []).join(", "));
  const [solvedBefore, setSolvedBefore] = useState(false);
  const [solvedOn, setSolvedOn] = useState("");
  const [solvedConf, setSolvedConf] = useState(3);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchState, setFetchState] = useState<{ text: string; existingId?: string | null }>({ text: "" });
  const lookupSeq = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editing = Boolean(initial);

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
    if (!editing && parsed.slug && (parsed.platform === "LeetCode" || parsed.platform === "GeeksforGeeks")) {
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
        videoUrl: f.videoUrl || p.videoUrl,
      }));
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
    const payload: Record<string, unknown> = { ...form, topics, companies };
    if (editing && initial?.status === form.status) delete payload.status;
    if (!editing && solvedBefore) {
      payload.backfill = { solvedAt: solvedOn, confidence: solvedConf };
    }
    try {
      const { item } = editing
        ? await send<{ item: QuestionJSON }>(`/api/questions/${initial!._id}`, "PATCH", payload)
        : await send<{ item: QuestionJSON }>("/api/questions", "POST", payload);
      onSaved(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  const platformOptions = [...new Set([...(facets?.platforms ?? []), ...KNOWN_PLATFORMS])];
  const resettingDone = editing && initial?.status === "done" && form.status !== "done";

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
                  Already in your library
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
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Platform
          <input
            list="platform-options"
            value={form.platform}
            onChange={(e) => set("platform", e.target.value)}
            className="field"
            placeholder="LeetCode, GFG, …"
          />
          <datalist id="platform-options">
            {platformOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
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
        <label className="grid gap-1 text-sm">
          Status
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as QuestionJSON["status"])}
            className="field"
          >
            <option value="todo">todo</option>
            <option value="in_progress">in progress</option>
            {initial?.status === "done" ? <option value="done">done</option> : null}
          </select>
        </label>
      </div>
      {resettingDone ? (
        <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          Resetting a done question clears its revision schedule. Attempt history is kept.
        </p>
      ) : null}
      {!editing ? (
        <p className="-mt-2 text-xs text-muted">To mark it done, log an attempt (or tick “already solved” below).</p>
      ) : null}
      <label className="grid gap-1 text-sm">
        Video link
        <input
          value={form.videoUrl}
          onChange={(e) => set("videoUrl", e.target.value)}
          className="field"
          placeholder="https://youtube.com/..."
          inputMode="url"
        />
      </label>
      <div className="grid gap-4">
        <label className="grid gap-1 text-sm">
          Source list
          <input
            list="source-options"
            value={form.sourceList}
            onChange={(e) => set("sourceList", e.target.value)}
            className="field"
            placeholder="Blind 75, NeetCode 150, custom"
          />
          <datalist id="source-options">
            {(facets?.sourceLists ?? []).map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Topics <span className="text-xs text-muted">comma separated{facets?.topics.length ? ` · existing: ${facets.topics.slice(0, 12).join(", ")}` : ""}</span>
        <input value={topics} onChange={(e) => setTopics(e.target.value)} className="field" placeholder="Arrays, Hashing" />
      </label>
      <label className="grid gap-1 text-sm">
        Companies <span className="text-xs text-muted">comma separated</span>
        <input value={companies} onChange={(e) => setCompanies(e.target.value)} className="field" placeholder="Google, Amazon" />
      </label>
      <label className="grid gap-1 text-sm">
        Notes <span className="text-xs text-muted">Markdown: approach, pitfalls, complexity, code</span>
        <textarea
          rows={8}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="field font-mono text-[13px]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isStarred} onChange={(e) => set("isStarred", e.target.checked)} />
        Star this (weak / must-revise)
      </label>

      {!editing ? (
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
          {saving ? "Saving…" : editing ? "Save changes" : "Create question"}
        </button>
      </div>
    </form>
  );
}
