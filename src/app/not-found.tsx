import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found — CrackQuick",
};

/** Shown for unmatched URLs and wherever a route calls notFound(). */
export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 grid max-w-xl gap-4 p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display text-3xl text-brass2">This page doesn&apos;t exist</h1>
      <p className="text-sm text-muted">
        The link may be broken, or the page may have been moved or removed. Head back to your desk or pick up a problem
        from the catalog.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">
          Back to desk
        </Link>
        <Link href="/questions" className="btn">
          Browse questions
        </Link>
      </div>
    </div>
  );
}
