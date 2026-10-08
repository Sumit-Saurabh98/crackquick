import { NextResponse } from "next/server";
import { listUsers } from "@/lib/users";
import { route } from "@/lib/viewer";

/** Needs users.manage. → { items: [{ id, name, email, role, providers, createdAt }] } */
export const GET = route(async () => NextResponse.json({ items: await listUsers() }), { permission: "users.manage" });
