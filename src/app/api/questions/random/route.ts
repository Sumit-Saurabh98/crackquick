import { NextResponse } from "next/server";
import { randomQuestionId } from "@/lib/queries";
import { route } from "@/lib/viewer";

/** Shuffle: a random question matching the list filters in the query string; `exclude` skips one id. `id` null if none match. */
export const GET = route(async (req, { viewer }) => {
  const search = req.nextUrl.searchParams;
  const id = await randomQuestionId(search, viewer, search.get("exclude") ?? undefined);
  return NextResponse.json({ id });
});
