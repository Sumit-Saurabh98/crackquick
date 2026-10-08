import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

/** Responds with `{ error }`; an error carrying a numeric `status` overrides the fallback status. */
export function fail(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const code =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : status;
  return NextResponse.json({ error: message }, { status: code });
}

export function csv(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** The id, or a 404 with `message` when it can't be a database id. */
export function checkId(id: string, message = "Not found") {
  if (!isValidObjectId(id)) throw Object.assign(new Error(message), { status: 404 });
  return id;
}
