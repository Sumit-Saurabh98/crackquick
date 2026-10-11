"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

/** Opens a random question matching `query` (list filters), skipping `exclude`. */
export function ShuffleButton({
  query = "",
  exclude,
  className = "btn",
  onEmpty,
}: {
  query?: string;
  exclude?: string;
  className?: string;
  onEmpty?: (message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function shuffle() {
    setBusy(true);
    try {
      const qs = new URLSearchParams(query);
      qs.delete("page");
      qs.delete("sort");
      if (exclude) qs.set("exclude", exclude);
      const { id } = await api<{ id: string | null }>(`/api/questions/random?${qs}`);
      if (id) router.push(`/questions/${id}`);
      else onEmpty?.(exclude ? "No other question to shuffle to." : "No questions match these filters.");
    } catch (e) {
      onEmpty?.(e instanceof Error ? e.message : "Shuffle failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={shuffle} disabled={busy} className={className} title="Pick a random question">
      ⤨ {busy ? "Picking…" : "Shuffle"}
    </button>
  );
}
