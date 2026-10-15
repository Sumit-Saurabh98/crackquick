"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { CategoryDot, CategoryPanel, type CategoryData } from "@/components/notes/CategoryPanel";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { formatDate } from "@/lib/dates";
import { readingMinutes, type NoteSummaryJSON } from "@/lib/noteTypes";
import { useApi } from "@/lib/useApi";

export default function NotesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Notes />
    </Suspense>
  );
}

function Notes() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const selected = params.get("category") ?? "";
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), [setToast]);

  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const categories = useApi<CategoryData>("/api/notes/categories");
  const qs = new URLSearchParams();
  if (selected) qs.set("category", selected);
  if (q) qs.set("q", q);
  const notes = useApi<{ items: NoteSummaryJSON[] }>(`/api/notes?${qs}`);

  const select = (f: string) => router.replace(f ? `${path}?category=${f}` : path, { scroll: false });
  const byId = new Map(categories.data?.items.map((c) => [c._id, c]) ?? []);
  const current = selected === "none" ? "Uncategorized" : selected ? byId.get(selected)?.name ?? "Notes" : "All notes";

  if (categories.error && !categories.data) return <ErrorPanel error={categories.error} />;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="eyebrow">Your notebook</p>
          <h1 className="display text-3xl">Notes</h1>
        </div>
        <Link href={selected && selected !== "none" ? `/notes/new?category=${selected}` : "/notes/new"} className="btn-primary ml-auto">
          + New note
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_1fr] lg:items-start">
        <CategoryPanel
          data={categories.data}
          selected={selected}
          onSelect={select}
          onChanged={() => {
            categories.reload();
            notes.reload();
          }}
          notify={setToast}
        />

        <section className="grid content-start gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="display text-xl">{current}</h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes"
              className="field ml-auto w-full sm:w-64"
            />
          </div>
          {notes.error ? <p className="text-sm text-warn">{notes.error}</p> : null}
          {!notes.data ? <Spinner /> : null}
          {notes.data && !notes.data.items.length ? (
            <div className="card grid justify-items-center gap-3 p-10 text-center">
              <p className="display text-xl text-brass2">{q ? "No notes match your search" : "No notes here yet"}</p>
              <p className="text-sm text-muted">{q ? "Try other words." : "Write your first one: headings, images, videos, checklists and more."}</p>
              {!q ? (
                <Link href={selected && selected !== "none" ? `/notes/new?category=${selected}` : "/notes/new"} className="btn-primary">
                  Write a note
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {notes.data?.items.map((n) => {
              const cat = n.categoryId ? byId.get(n.categoryId) : undefined;
              return (
                <Link key={n._id} href={`/notes/${n._id}`} className="card grid content-start gap-2 p-4 transition-colors hover:border-brass/40">
                  <h3 className="display line-clamp-2 text-lg leading-snug text-brass2">{n.title}</h3>
                  {n.excerpt ? <p className="line-clamp-3 text-sm text-muted">{n.excerpt}</p> : <p className="text-sm italic text-muted/70">Empty note</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted">
                    {cat ? (
                      <span className="flex items-center gap-1.5">
                        <CategoryDot color={cat.color} />
                        {cat.name}
                      </span>
                    ) : null}
                    <span>Updated {formatDate(n.updatedAt)}</span>
                    <span>{readingMinutes(n.words)} min read</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
