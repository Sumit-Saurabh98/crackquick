import { NextResponse } from "next/server";
import { setRole } from "@/lib/users";
import { route } from "@/lib/viewer";

/** Needs users.manage. Body: { role: "user" | "editor" | "admin" }. Applies on the user's next request. */
export const PATCH = route<{ id: string }>(
  async (req, { params }) => {
    const { role } = await req.json();
    return NextResponse.json({ id: params.id, role: await setRole(params.id, role) });
  },
  { permission: "users.manage", errorStatus: 400 },
);
