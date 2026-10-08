"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useCan, useViewer } from "@/components/ViewerProvider";
import { send } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { PERMISSIONS, ROLE_INFO, ROLES, type Role } from "@/lib/rbac";
import type { UserJSON } from "@/lib/users";
import { useApi } from "@/lib/useApi";

const PROVIDER_LABEL: Record<string, string> = { credential: "Email", github: "GitHub", google: "Google" };

export default function UsersPage() {
  if (!useCan("users.manage")) return <ErrorPanel error="You don't have permission to manage users." />;
  return <Users />;
}

function Users() {
  const me = useViewer()!;
  const router = useRouter();
  const { data, error, reload } = useApi<{ items: UserJSON[] }>("/api/users");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  async function changeRole(u: UserJSON, role: Role) {
    const self = u.id === me.id;
    if (self && !confirm(`Change your own role to ${ROLE_INFO[role].label}? You'll lose access to this page.`)) return;
    setBusy(u.id);
    setActionError("");
    try {
      await send(`/api/users/${u.id}`, "PATCH", { role });
      setToast(`${u.name || u.email} is now ${ROLE_INFO[role].label}`);
      if (self) router.refresh();
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not change role");
    } finally {
      setBusy("");
    }
  }

  async function toggleSuspend(u: UserJSON) {
    let reason = "";
    if (!u.suspended) {
      const answer = prompt(
        `Suspend ${u.name || u.email}?\n\nThey're signed out everywhere, can't sign in or use the app, and their pending suggestions are hidden. Their data is kept and you can restore them any time.\n\nReason (optional, for other admins):`,
      );
      if (answer === null) return;
      reason = answer;
    } else if (!confirm(`Restore ${u.name || u.email}? They can sign in again.`)) return;
    setBusy(u.id);
    setActionError("");
    try {
      await send(`/api/users/${u.id}`, "PATCH", { suspended: !u.suspended, reason });
      setToast(u.suspended ? `${u.name || u.email} restored` : `${u.name || u.email} suspended`);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not change suspension");
    } finally {
      setBusy("");
    }
  }

  if (error && !data) return <ErrorPanel error={error} />;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <p className="eyebrow">Access</p>
        <h1 className="display text-3xl">Users</h1>
        <p className="text-sm text-muted">{data ? `${data.items.length} accounts` : <Spinner size="sm" />}. A role change applies on the user&apos;s next click.</p>
      </div>

      {actionError ? <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{actionError}</p> : null}

      <div className="card">
        {!data ? <Spinner className="min-h-[20vh]" /> : null}
        {data?.items.map((u) => (
          <div
            key={u.id}
            className={`flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 ${u.suspended ? "bg-warn/5" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {u.name || u.email}
                {u.id === me.id ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
                {u.suspended ? <span className="pill ml-2 bg-warn/15 text-warn">suspended</span> : null}
              </p>
              <p className="truncate text-xs text-muted">
                {[
                  u.email,
                  u.providers.length ? u.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(" + ") : "hasn't signed in yet",
                  u.createdAt ? `joined ${formatDate(u.createdAt)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {u.suspended ? (
                <p className="truncate text-xs text-warn">
                  Suspended{u.suspendedAt ? ` ${formatDate(u.suspendedAt)}` : ""}
                  {u.suspendedReason ? `: ${u.suspendedReason}` : ""}
                </p>
              ) : null}
            </div>
            <select
              value={u.role}
              disabled={busy === u.id}
              onChange={(e) => changeRole(u, e.target.value as Role)}
              className="field w-auto"
              aria-label={`Role of ${u.name || u.email}`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </select>
            {u.id !== me.id ? (
              <button
                onClick={() => toggleSuspend(u)}
                disabled={busy === u.id}
                className={`btn btn-sm ${u.suspended ? "" : "border-warn/40 text-warn"}`}
              >
                {u.suspended ? "Restore" : "Suspend"}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <RateLimits />

      <section className="card grid gap-3 p-5">
        <h2 className="display text-xl">Roles</h2>
        <p className="text-xs text-muted">
          Everyone can browse the catalog, set their timezone and suggest new questions or edits.
        </p>
        {ROLES.map((r) => (
          <div key={r} className="grid gap-1 border-t border-line pt-3 text-sm">
            <p>
              <span className="font-medium">{ROLE_INFO[r].label}</span>{" "}
              <span className="text-muted">· {ROLE_INFO[r].description}</span>
            </p>
            {ROLE_INFO[r].permissions.length ? (
              <ul className="grid gap-0.5 text-xs text-muted">
                {ROLE_INFO[r].permissions.map((p) => (
                  <li key={p}>
                    <code className="text-brass2">{p}</code> {PERMISSIONS[p]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

type LimitsJSON = {
  limits: { kind: string; label: string; max: number; per: string }[];
  maxPendingEdits: number;
  items: { userId: string; kind: string; name: string; email: string; suspended: boolean; requests: number; blocked: number; peak: number; inCurrentWindow: boolean }[];
};

/** Who is using the rate-limited actions, last 7 days; people who hit a limit first. */
function RateLimits() {
  const { data, error } = useApi<LimitsJSON>("/api/admin/limits");
  const label = new Map(data?.limits.map((l) => [l.kind, l]) ?? []);
  return (
    <section className="card grid gap-3 p-5">
      <div>
        <h2 className="display text-xl">Rate limits</h2>
        <p className="text-xs text-muted">
          {data
            ? [
                ...data.limits.map((l) => `${l.label}: ${l.max} per ${l.per}`),
                `pending edit suggestions: ${data.maxPendingEdits}`,
                "sign-in: 5 tries a minute per IP; sign-up: 5 an hour per IP",
              ].join(" · ")
            : "Loading…"}
          . Editors and admins aren&apos;t limited on lookups or suggestions.
        </p>
      </div>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {data && !data.items.length ? <p className="text-sm text-muted">No limited actions in the last 7 days.</p> : null}
      {data?.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1 pr-3 font-normal">User</th>
                <th className="py-1 pr-3 font-normal">Action</th>
                <th className="py-1 pr-3 text-right font-normal">Requests (7d)</th>
                <th className="py-1 pr-3 text-right font-normal">Busiest window</th>
                <th className="py-1 text-right font-normal">Refused</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const l = label.get(r.kind);
                return (
                  <tr key={`${r.userId}-${r.kind}`} className="border-t border-line">
                    <td className="max-w-[14rem] truncate py-1.5 pr-3">
                      {r.name || r.email}
                      {r.suspended ? <span className="ml-1 text-xs text-warn">(suspended)</span> : null}
                    </td>
                    <td className="py-1.5 pr-3 text-muted">{l?.label ?? r.kind}</td>
                    <td className="py-1.5 pr-3 text-right">{r.requests}</td>
                    <td className="py-1.5 pr-3 text-right text-muted">
                      {r.peak} / {l?.max ?? "?"} per {l?.per ?? "window"}
                    </td>
                    <td className={`py-1.5 text-right ${r.blocked ? "text-warn" : "text-muted"}`}>{r.blocked}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
