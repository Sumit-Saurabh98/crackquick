import { NextResponse } from "next/server";
import { route } from "@/lib/viewer";
import { AppConfig, getAppConfig } from "@/models/AppConfig";

/** Needs submissions.review. The saved one-click rejection reasons. */
export const GET = route(async () => NextResponse.json({ items: (await getAppConfig()).rejectReasons }), {
  permission: "submissions.review",
});

/** Needs submissions.review. Body: { items: string[] } replaces the list (trimmed, de-duplicated, max 20). */
export const PUT = route(
  async (req) => {
    const { items } = await req.json();
    const clean = [
      ...new Map(
        (Array.isArray(items) ? items : [])
          .map((s: unknown) => String(s ?? "").trim().slice(0, 120))
          .filter(Boolean)
          .map((s: string) => [s.toLowerCase(), s]),
      ).values(),
    ].slice(0, 20);
    await AppConfig.updateOne({ key: "main" }, { $set: { rejectReasons: clean } }, { upsert: true });
    return NextResponse.json({ items: clean });
  },
  { permission: "submissions.review", errorStatus: 400 },
);
