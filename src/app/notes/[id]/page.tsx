"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { CategoryDot, type CategoryData } from "@/components/notes/CategoryPanel";
import { RichContent } from "@/components/notes/RichContent";
import { Spinner } from "@/components/Spinner";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { readingMinutes, type NoteJSON } from "@/lib/noteTypes";
import { useApi } from "@/lib/useApi";

/** A note, read like a blog post, with Edit and Delete. */
export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useApi<{ item: NoteJSON }>(`/api/notes/${id}`);
  const categories = useApi<CategoryData>("/api/notes/categories");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  if (error && !data) return <ErrorPanel error={error} />;
  if (!data) return <Spinner />;
  const n = data.item;
  const cat = n.categoryId ? categories.data?.items.find((c) => c._id === n.categoryId) : undefined;
  const edited = new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 60_000;

  async function remove() {
    if (!confirm(`Delete “${n.title}”? This can't be undone.`)) return;
    setBusy(true);
    setActionError("");
    try {
      await send(`/api/notes/${n._id}`, "DELETE");
      router.push(n.categoryId ? `/notes?category=${n.categoryId}` : "/notes");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={cat ? `/notes?category=${cat._id}` : "/notes"} className="text-sm text-muted hover:text-ink">
          ← {cat ? cat.name : "All notes"}
        </Link>
        <span className="ml-auto flex gap-2">
          <Link href={`/notes/${n._id}/edit`} className="btn btn-sm">
            Edit
          </Link>
          <button onClick={remove} disabled={busy} className="btn btn-sm border-warn/40 text-warn">
            Delete
          </button>
        </span>
      </div>
      <header className="grid gap-3 border-b border-line pb-6">
        {cat ? (
          <Link href={`/notes?category=${cat._id}`} className="eyebrow flex w-fit items-center gap-2 hover:text-ink">
            <CategoryDot color={cat.color} />
            {cat.name}
          </Link>
        ) : null}
        <h1 className="display text-4xl leading-tight text-brass2 sm:text-5xl">{n.title}</h1>
        <p className="text-sm text-muted">
          {formatDate(n.createdAt)}
          {edited ? ` · updated ${formatDate(n.updatedAt, true)}` : ""} · {readingMinutes(n.words)} min read
        </p>
      </header>
      {actionError ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{actionError}</p> : null}
      {n.words || (n.content.content as unknown[] | undefined)?.length ? <RichContent content={n.content} /> : <p className="italic text-muted">This note is empty.</p>}
    </article>
  );
}
