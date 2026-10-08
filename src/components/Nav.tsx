"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useViewer } from "@/components/ViewerProvider";
import { authClient } from "@/lib/auth-client";
import { ROLE_INFO, type Permission } from "@/lib/rbac";

const links: { href: string; label: string; permission?: Permission }[] = [
  { href: "/", label: "Desk" },
  { href: "/review", label: "Review" },
  { href: "/questions", label: "Questions" },
  { href: "/progress", label: "Progress" },
  { href: "/submissions", label: "Submissions" },
  { href: "/users", label: "Users", permission: "users.manage" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  const viewer = useViewer();
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="" width={32} height={32} priority />
          <span className="display text-xl tracking-tight text-brass2">CrackQuick</span>
        </Link>
        {viewer ? (
          <nav className="-mr-2 flex min-w-0 items-center gap-1 overflow-x-auto pr-2 text-sm">
            {links.filter((l) => !l.permission || viewer.permissions.includes(l.permission)).map((l) => {
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
              {viewer.permissions.includes("catalog.edit") ? "+ Add" : "+ Suggest"}
            </Link>
            <Account />
          </nav>
        ) : null}
      </div>
    </header>
  );
}

function Account() {
  const viewer = useViewer()!;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh(); // re-render the layout without the old user
  }

  return (
    <div className="relative ml-1 shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account"
        title={viewer.email}
        className="grid size-8 place-items-center rounded-full border border-line bg-bg2 text-xs uppercase text-brass2 hover:border-brass/40"
      >
        {(viewer.name || viewer.email).slice(0, 1)}
      </button>
      {open ? (
        <div className="card fixed right-4 top-14 z-30 grid w-64 gap-2 p-4 text-sm sm:right-6">
          <p className="truncate font-medium">{viewer.name || viewer.email}</p>
          <p className="truncate text-xs text-muted">{viewer.email}</p>
          {viewer.role !== "user" ? <span className="pill w-fit bg-brass/15 text-brass2">{ROLE_INFO[viewer.role].label}</span> : null}
          <button onClick={signOut} disabled={busy} className="btn btn-sm mt-1">
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
