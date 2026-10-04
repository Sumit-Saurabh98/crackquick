"use client";

import Link from "next/link";
import { useState } from "react";

/** Company chips (biggest first, as stored), each linking to the library filtered by that company. */
export function CompanyTags({ companies, limit = 4, size = "sm" }: { companies: string[]; limit?: number; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  if (!companies.length) return null;
  const shown = open ? companies : companies.slice(0, limit);
  const rest = companies.length - shown.length;
  const chip =
    size === "md"
      ? "rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-xs text-sky-200 hover:border-sky-300/60"
      : "rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-px text-[11px] text-sky-200 hover:border-sky-300/60";
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((c) => (
        <Link key={c} href={`/questions?company=${encodeURIComponent(c)}`} className={chip}>
          {c}
        </Link>
      ))}
      {rest > 0 || open ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="px-1 text-[11px] text-muted hover:text-ink">
          {open ? "show less" : `+${rest} more`}
        </button>
      ) : null}
    </span>
  );
}
