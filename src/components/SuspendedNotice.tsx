"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Shown instead of the app to a suspended account that still has a session. */
export function SuspendedNotice() {
  const router = useRouter();
  return (
    <div className="card mx-auto grid max-w-md gap-3 p-6 text-center">
      <h1 className="display text-2xl text-warn">Account suspended</h1>
      <p className="text-sm text-muted">
        An admin has suspended this account. Your progress is kept; contact the admin if you think this is a mistake.
      </p>
      <div>
        <button
          className="btn"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
