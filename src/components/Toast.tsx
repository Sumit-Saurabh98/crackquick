"use client";

import { useEffect } from "react";
import { formatDate } from "@/lib/dates";

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-brass/40 bg-bg2 px-4 py-2 text-sm text-brass2 shadow-lg"
    >
      {message}
    </div>
  );
}

export function attemptMessage(r: { kind: string; item: { nextRevisionAt: string | null } }) {
  const verb = r.kind === "failed_recall" ? "Logged blank" : r.kind === "solved" ? "Solved" : "Revised";
  return `${verb} · next review ${r.item.nextRevisionAt ? formatDate(r.item.nextRevisionAt) : "not scheduled"}`;
}
