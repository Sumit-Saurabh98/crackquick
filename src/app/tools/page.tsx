import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Tools — CrackQuick" };

const TOOLS = [
  {
    href: "/tools/recursion",
    title: "Recursion & Backtracking Visualizer",
    description: "Run any recursive function and watch the call tree grow, the stack fill up, and every backtrack come back up, step by step.",
    tags: ["Recursion", "Backtracking", "DP"],
    icon: (
      <svg viewBox="0 0 48 48" className="size-12" aria-hidden>
        <rect x="18" y="4" width="12" height="9" rx="3" fill="#e0b366" />
        <rect x="5" y="22" width="12" height="9" rx="3" fill="#151d2b" stroke="#3dba8b" strokeWidth="2" />
        <rect x="31" y="22" width="12" height="9" rx="3" fill="#3b1823" stroke="#f0607a" strokeWidth="2" strokeDasharray="3 2" />
        <rect x="5" y="37" width="12" height="8" rx="3" fill="#11352a" stroke="#3dba8b" strokeWidth="2" />
        <path d="M24 13 C24 18 11 17 11 22 M24 13 C24 18 37 17 37 22 M11 31 V37" fill="none" stroke="#e0b366" strokeWidth="1.8" />
        <path d="M41 21 C41 15 30 16 30 12" fill="none" stroke="#5fb4ff" strokeWidth="2" strokeDasharray="3 2" />
      </svg>
    ),
  },
];

export default function ToolsPage() {
  return (
    <div className="grid gap-5">
      <div>
        <p className="eyebrow">Learn by seeing</p>
        <h1 className="display text-3xl">Tools</h1>
        <p className="text-sm text-muted">Interactive visualizers that make hard ideas easy to follow. More are on the way.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="card group grid content-start gap-3 p-5 transition-colors hover:border-brass/50">
            {t.icon}
            <h2 className="display text-xl leading-snug text-brass2">{t.title}</h2>
            <p className="text-sm text-muted">{t.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {t.tags.map((tag) => (
                <span key={tag} className="pill bg-brass/10 text-brass2">
                  {tag}
                </span>
              ))}
            </div>
            <span className="text-sm text-brass2 group-hover:underline">Open →</span>
          </Link>
        ))}
        <div className="card grid place-items-center gap-1 border-dashed p-5 text-center text-sm text-muted">
          <span className="text-2xl">＋</span>
          More tools coming soon
        </div>
      </div>
    </div>
  );
}
