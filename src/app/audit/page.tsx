"use client";

import { useCallback, useState } from "react";
import { AuditList } from "@/components/AuditList";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useCan } from "@/components/ViewerProvider";
import type { AuditJSON } from "@/lib/audit";
import { useApi } from "@/lib/useApi";

export default function AuditPage() {
  if (!useCan("catalog.edit")) return <ErrorPanel error="You don't have permission to see catalog changes." />;
  return <Audit />;
}

function Audit() {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApi<{ items: AuditJSON[]; page: number; pages: number }>(`/api/audit?page=${page}`);
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  if (error && !data) return <ErrorPanel error={error} />;
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <p className="eyebrow">Catalog</p>
        <h1 className="display text-3xl">Change history</h1>
        <p className="text-sm text-muted">Every change to catalog questions: who, when, and old → new. Edits, retires and restores can be reverted.</p>
      </div>
      <section className="card p-5">
        {data ? (
          <AuditList
            items={data.items}
            showQuestion
            onChanged={(m) => {
              setToast(m);
              reload();
            }}
          />
        ) : (
          <Spinner />
        )}
      </section>
      {data && data.pages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Newer
          </button>
          <span className="text-muted">
            Page {data.page} / {data.pages}
          </span>
          <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Older →
          </button>
        </div>
      ) : null}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
