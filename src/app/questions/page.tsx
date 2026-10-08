"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { BulkBar } from "@/components/BulkBar";
import { QuestionRow } from "@/components/QuestionRow";
import { Spinner } from "@/components/Spinner";
import { attemptMessage, Toast } from "@/components/Toast";
import { useCan } from "@/components/ViewerProvider";
import { DIFFICULTIES } from "@/lib/constants";
import type { Facets } from "@/lib/queries";
import type { QuestionJSON } from "@/lib/serialize";
import { useApi } from "@/lib/useApi";

type Page = { items: QuestionJSON[]; total: number; page: number; pages: number };

export default function QuestionsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <QuestionsView />
    </Suspense>
  );
}

function QuestionsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const { data, error, reload } = useApi<Page>(`/api/questions?${query}`);
  // Bulk selection belongs to one filter set; changing the filters starts it fresh.
  const [selection, setSelection] = useState({ query, ids: new Set<string>(), all: false });
  const sel = selection.query === query ? selection : { query, ids: new Set<string>(), all: false };
  const selectRows = (ids: Set<string>, all: boolean) => setSelection({ query, ids, all });
  const facets = useApi<Facets>("/api/meta").data;
  const canEdit = useCan("catalog.edit");
  const practises = useCan("practice.track");
  const [text, setText] = useState(params.get("q") ?? "");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Debounced search box → URL
  useEffect(() => {
    if (text === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: text }), 300);
    return () => clearTimeout(t);
  }, [text, params, update]);

  const v = (k: string) => params.get(k) ?? "";
  const active = [...params.keys()].filter((k) => !["sort", "page"].includes(k)).length;

  const select = (key: string, label: string, options: (string | [string, string])[]) => (
    <select value={v(key)} onChange={(e) => update({ [key]: e.target.value })} className="field" aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => {
        const [value, text] = Array.isArray(o) ? o : [o, o];
        return (
          <option key={value} value={value}>
            {text}
          </option>
        );
      })}
    </select>
  );

  if (error && !data) return <ErrorPanel error={error} />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{practises ? "Library" : "Catalog"}</p>
          <h1 className="display text-3xl">Questions</h1>
          <p className="text-sm text-muted">{data ? `${data.total} matching` : <Spinner size="sm" />}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <Link href="/health" className="btn">
                Health
              </Link>
              <Link href="/duplicates" className="btn">
                Find duplicates
              </Link>
            </>
          ) : null}
          <Link href="/questions/new" className="btn-primary">
            {canEdit ? "+ Add question" : "+ Suggest a question"}
          </Link>
        </div>
      </div>

      <div className="card grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          placeholder={practises ? "Search title, notes, topics" : "Search title, topics, companies, number"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="field sm:col-span-2"
          aria-label="Search"
        />
        {practises
          ? select("revision", "Any schedule", [
              ["queue", "Review queue (due + overdue)"],
              ["overdue", "Overdue"],
              ["due", "Due today"],
              ["upcoming", "Upcoming"],
              ["none", "Unscheduled"],
            ])
          : null}
        {practises
          ? select("sort", "Sort: next revision", [
              ["updated", "Sort: recently updated"],
              ["last", "Sort: rustiest first"],
              ["difficulty", "Sort: difficulty"],
              ["title", "Sort: title"],
              ["times", "Sort: times solved"],
            ])
          : select("sort", "Sort: recently updated", [
              ["difficulty", "Sort: difficulty"],
              ["title", "Sort: title"],
            ])}
        {select("difficulty", "Any difficulty", [...DIFFICULTIES])}
        {practises ? (
          <>
            {select("status", "Any status", [
              ["todo", "Todo"],
              ["in_progress", "In progress"],
              ["done", "Done"],
            ])}
            {select("lastDone", "Last done: any", [
              ["never", "Never solved"],
              ["today", "Solved today"],
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
              ["90plus", "90+ days ago"],
            ])}
            {select("maxConfidence", "Any confidence", [
              ["2", "Confidence ≤ 2"],
              ["3", "Confidence ≤ 3"],
              ["4", "Confidence ≤ 4"],
            ])}
          </>
        ) : null}
        {select("topic", "Any topic", facets?.topics ?? [])}
        {select("pattern", "Any pattern", facets?.patterns ?? [])}
        {select("company", "Any company", facets?.companies ?? [])}
        {select("platform", "Any platform", facets?.platforms ?? [])}
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 lg:col-span-3">
          {(
            [
              ...(practises
                ? ([
                    ["starred", "★ Starred"],
                    ["archived", "Hidden by me"],
                  ] as const)
                : []),
              ...(canEdit ? ([["retired", "Retired"]] as const) : []),
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={v(k) === "1"}
              onClick={() => update({ [k]: v(k) === "1" ? "" : "1" })}
              className="chip"
            >
              {label}
            </button>
          ))}
          {active ? (
            <button
              type="button"
              onClick={() => {
                setText("");
                router.replace(pathname, { scroll: false });
              }}
              className="ml-auto text-xs text-brass2"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {canEdit && data?.items.length ? (
        <BulkBar
          pageIds={data.items.map((q) => q._id)}
          selected={sel.ids}
          allMatching={sel.all}
          total={data.total}
          query={query}
          onSelect={selectRows}
          onDone={(m) => {
            setToast(m);
            selectRows(new Set(), false);
            reload();
          }}
        />
      ) : null}
      <div className="card">
        {!data ? <Spinner className="min-h-[30vh]" /> : null}
        {data?.items.map((q) => (
          <QuestionRow
            key={q._id}
            q={q}
            onChanged={reload}
            onLogged={(r) => setToast(attemptMessage(r))}
            selected={sel.all || sel.ids.has(q._id)}
            onSelect={
              canEdit
                ? (checked) => {
                    const ids = new Set(sel.ids);
                    if (checked) ids.add(q._id);
                    else ids.delete(q._id);
                    selectRows(ids, false);
                  }
                : undefined
            }
          />
        ))}
        {data && data.items.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            {active
              ? "Nothing matches these filters."
              : canEdit
                ? "No questions yet. Use + Add question to import from LeetCode / GFG."
                : "The catalog is empty. Use + Suggest a question to propose one."}
          </p>
        ) : null}
      </div>

      {data && data.pages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn btn-sm" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })}>
            ← Prev
          </button>
          <span className="text-muted">
            Page {data.page} / {data.pages}
          </span>
          <button
            className="btn btn-sm"
            disabled={data.page >= data.pages}
            onClick={() => update({ page: String(data.page + 1) })}
          >
            Next →
          </button>
        </div>
      ) : null}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
