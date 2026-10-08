import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { setRole, setSuspended } from "@/lib/users";
import { route } from "@/lib/viewer";

/**
 * Needs users.manage. Body: { role: "user" | "editor" | "admin" } or { suspended: boolean, reason? }.
 * Applies on the user's next request (suspending also signs them out everywhere).
 */
export const PATCH = route<{ id: string }>(
  async (req, { viewer, params }) => {
    const body = await req.json();
    if (typeof body.suspended === "boolean") {
      return NextResponse.json({ id: params.id, suspended: await setSuspended(viewer.id, params.id, body.suspended, body.reason) });
    }
    if (body.role === undefined) throw new HttpError("Send role or suspended.", 400);
    return NextResponse.json({ id: params.id, role: await setRole(params.id, body.role) });
  },
  { permission: "users.manage", errorStatus: 400 },
);
