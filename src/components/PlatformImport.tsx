"use client";

import Link from "next/link";
import { useState } from "react";
import { OptionSelect } from "@/components/OptionSelect";
import { DifficultyPill } from "@/components/Pills";
import { send } from "@/lib/api";
import type { FoundProblem } from "@/lib/platforms";
import type { PlatformKey } from "@/lib/problemUrl";

type Found = FoundProblem & { existingId: string | null };

const PLATFORMS: { id: PlatformKey; label: string; placeholder: string; hint: string }[] = [
  {
    id: "leetcode",
    label: "LeetCode",
    placeholder: "1, 15, 146\n200-210\nhttps://leetcode.com/problems/lru-cache/\nMedian of Two Sorted Arrays",
    hint: "Problem numbers, ranges (200-210), links, or exact names. Comma or one per line, up to 100.",
  },
  {
    id: "gfg",
    label: "GeeksforGeeks",
    placeholder: "https://www.geeksforgeeks.org/problems/subarray-with-given-sum-1587115621/1\n700366\nLRU Cache",
    hint: "Problem links (easiest), GFG problem IDs, or names. Comma or one per line, up to 100. Company tags come along.",
  },
];

export function PlatformImport() {
  const [platform, setPlatform] = useState<PlatformKey>("leetcode");
  const [input, setInput] = useState("");
  const [pattern, setPattern] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"" | "lookup" | "import">("");
  const [message, setMessage] = useState("");
  const conf = PLATFORMS.find((p) => p.id === platform)!;

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy("lookup");
    setMessage("");
    setErrors([]);
    try {
      const r = await send<{ items: Found[]; errors: string[] }>("/api/lookup", "POST", { platform, input });
      setFound(r.items);
      setErrors(r.errors);
      setPicked(new Set(r.items.filter((p) => !p.existingId).map((p) => p.platformUrl)));
    } catch (err) {
      setFound(null);
      setErrors([err instanceof Error ? err.message : "Lookup failed"]);
    } finally {
      setBusy("");
    }
  }

  async function importPicked() {
    if (!found) return;
    setBusy("import");
    try {
      const questions = found.filter((p) => picked.has(p.platformUrl));
      const r = await send<{ imported: number; skipped: number }>("/api/import", "POST", { questions, pattern });
      setMessage(`Imported ${r.imported}${r.skipped ? `, skipped ${r.skipped} already in your library` : ""}.`);
      setFound(null);
      setInput("");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Import failed"]);
    } finally {
      setBusy("");
    }
  }

  function toggle(url: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  const fresh = found?.filter((p) => !p.existingId) ?? [];

  return (
    <div className="grid gap-4">
      <form onSubmit={lookup} className="card grid gap-4 p-5">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={platform === p.id}
              onClick={() => {
                setPlatform(p.id);
                setFound(null);
                setErrors([]);
              }}
              className="chip"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm">
          What to import
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={conf.placeholder}
            className="field font-mono text-[13px]"
          />
          <span className="text-xs text-muted">{conf.hint}</span>
        </label>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-[240px] flex-1 gap-1 text-sm">
            <label htmlFor="import-pattern">
              Pattern <span className="text-xs text-muted">optional, applied to all imported</span>
            </label>
            <OptionSelect id="import-pattern" kind="pattern" value={pattern} onChange={setPattern} />
          </div>
          <button disabled={!input.trim() || busy !== ""} className="btn-primary">
            {busy === "lookup" ? `Looking up on ${conf.label}…` : "Look up"}
          </button>
        </div>
      </form>

      {errors.length ? (
        <ul className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-good/10 px-4 py-3 text-sm text-good">
          {message}{" "}
          <Link href="/questions?sort=updated" className="underline">
            Open library
          </Link>
        </p>
      ) : null}

      {found && found.length ? (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm">
              Found {found.length}
              {found.length - fresh.length ? ` · ${found.length - fresh.length} already in library` : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  setPicked(picked.size === fresh.length ? new Set() : new Set(fresh.map((p) => p.platformUrl)))
                }
              >
                {picked.size === fresh.length ? "Select none" : "Select all"}
              </button>
              <button type="button" disabled={!picked.size || busy !== ""} onClick={importPicked} className="btn-primary btn-sm">
                {busy === "import" ? "Importing…" : `Import ${picked.size}`}
              </button>
            </div>
          </div>
          <ul>
            {found.map((p) => (
              <li key={p.platformUrl} className="border-b border-line last:border-0">
                <label className={`flex items-start gap-3 px-4 py-2.5 ${p.existingId ? "opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={Boolean(p.existingId)}
                    checked={picked.has(p.platformUrl)}
                    onChange={() => toggle(p.platformUrl)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted">#{p.externalId}</span>
                      <span className="font-medium">{p.title}</span>
                      <DifficultyPill value={p.difficulty} />
                      {p.paidOnly ? <span className="pill bg-brass/15 text-brass2">premium</span> : null}
                      {p.existingId ? (
                        <Link href={`/questions/${p.existingId}`} className="pill bg-white/5 text-muted">
                          already added
                        </Link>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {[p.topics.join(", "), p.companies.length ? `companies: ${p.companies.slice(0, 6).join(", ")}${p.companies.length > 6 ? "…" : ""}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
