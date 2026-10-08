"use client";

import Link from "next/link";
import { useState } from "react";
import { send } from "@/lib/api";
import type { AnnouncementJSON } from "@/lib/announcements";
import { useApi } from "@/lib/useApi";

export const TONE_STYLE: Record<AnnouncementJSON["tone"], { box: string; label: string; icon: string }> = {
  info: { box: "border-line bg-bg2", label: "Note", icon: "ℹ" },
  new: { box: "border-good/40 bg-good/10", label: "New", icon: "✦" },
  warning: { box: "border-warn/40 bg-warn/10", label: "Heads up", icon: "!" },
};

/** Live announcements for this user; ✕ hides one for good (saved to their account). */
export function AnnouncementBanner() {
  const { data } = useApi<{ items: AnnouncementJSON[] }>("/api/announcements");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const items = (data?.items ?? []).filter((a) => !hidden.has(a._id));
  if (!items.length) return null;

  return (
    <div className="grid gap-2">
      {items.map((a) => (
        <AnnouncementCard
          key={a._id}
          a={a}
          onDismiss={() => {
            setHidden((h) => new Set(h).add(a._id));
            void send(`/api/announcements/${a._id}/dismiss`, "POST").catch(() => undefined);
          }}
        />
      ))}
    </div>
  );
}

export function AnnouncementCard({ a, onDismiss }: { a: AnnouncementJSON; onDismiss?: () => void }) {
  const tone = TONE_STYLE[a.tone];
  const external = /^https?:\/\//.test(a.linkUrl);
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone.box}`}>
      <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide text-brass2" aria-hidden="true">
        {tone.icon} {tone.label}
      </span>
      <p className="min-w-0 flex-1">
        {a.message}
        {a.linkUrl ? (
          <>
            {" "}
            {external ? (
              <a href={a.linkUrl} target="_blank" rel="noreferrer" className="text-brass2 underline">
                {a.linkLabel || "Open"} ↗
              </a>
            ) : (
              <Link href={a.linkUrl} className="text-brass2 underline">
                {a.linkLabel || "Open"}
              </Link>
            )}
          </>
        ) : null}
      </p>
      {onDismiss ? (
        <button onClick={onDismiss} className="shrink-0 text-muted hover:text-ink" aria-label="Dismiss announcement" title="Dismiss">
          ✕
        </button>
      ) : null}
    </div>
  );
}
