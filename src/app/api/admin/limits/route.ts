import { NextResponse } from "next/server";
import { LIMITS, limitUsage, MAX_PENDING_EDITS } from "@/lib/rateLimit";
import { listUsers } from "@/lib/users";
import { route } from "@/lib/viewer";

/** Needs users.manage. Who is using the rate-limited actions, and who has been refused, last 7 days. */
export const GET = route(
  async () => {
    const [usage, users] = await Promise.all([limitUsage(), listUsers()]);
    const byId = new Map(users.map((u) => [u.id, u]));
    return NextResponse.json({
      limits: Object.entries(LIMITS).map(([kind, l]) => ({ kind, label: l.label, max: l.max, per: l.per })),
      maxPendingEdits: MAX_PENDING_EDITS,
      items: usage.map((r) => ({
        ...r,
        name: byId.get(r.userId)?.name ?? "",
        email: byId.get(r.userId)?.email ?? "(deleted account)",
        suspended: byId.get(r.userId)?.suspended ?? false,
      })),
    });
  },
  { permission: "users.manage" },
);
