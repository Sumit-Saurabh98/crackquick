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

export function notFoundUnlessValidId(id: string) {
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  return null;
}
