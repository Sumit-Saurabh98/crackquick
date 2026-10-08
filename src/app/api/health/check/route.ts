import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { checkLinksBatch } from "@/lib/health";
import { route } from "@/lib/viewer";

/**
 * Needs catalog.edit. Body: { since: ISO time the run started }. Checks the next batch of links not
 * checked since then; call again until `remaining` is 0.
 */
export const POST = route(
  async (req, { viewer }) => {
    const { since } = await req.json();
    const start = new Date(String(since ?? ""));
    if (Number.isNaN(start.getTime()) || start.getTime() > Date.now() + 60_000) throw new HttpError("Send the run's start time.", 400);
    return NextResponse.json(await checkLinksBatch(start, viewer.name || viewer.email));
  },
  { permission: "catalog.edit", errorStatus: 400 },
);
