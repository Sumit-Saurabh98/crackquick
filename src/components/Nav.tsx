"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Desk" },
  { href: "/review", label: "Review" },
  { href: "/questions", label: "Questions" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-2">
          <span className="display text-xl tracking-tight text-brass2">CrackQuick</span>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-muted lg:inline">interview forge</span>
        </Link>
        <nav className="-mr-2 flex min-w-0 items-center gap-1 overflow-x-auto pr-2 text-sm">
          {links.map((l) => {
            const on = l.href === "/" ? path === "/" : path.startsWith(l.href) && path !== "/questions/new";
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 ${on ? "bg-brass text-bg" : "text-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/questions/new"
            className={`ml-1 shrink-0 rounded-full border border-brass/40 px-3 py-1.5 text-brass2 hover:bg-brass/10 ${
              path === "/questions/new" ? "bg-brass/15" : ""
            }`}
          >
            + Add
          </Link>
        </nav>
      </div>
    </header>
  );
}
