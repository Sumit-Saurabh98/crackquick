import { NextResponse } from "next/server";
import { applyBulk, bulkTargets } from "@/lib/bulk";
import { route } from "@/lib/viewer";

/**
 * Needs catalog.edit. Body: { ids: string[] } or { query: "<list filters>" }, plus { action, value }.
 * With { preview: true } only counts the targets.
 */
export const POST = route(
  async (req, { viewer }) => {
    const body = await req.json();
    const ids = await bulkTargets(viewer, body);
    if (body.preview) return NextResponse.json({ count: ids.length });
    return NextResponse.json(await applyBulk(viewer, ids, body.action, body.value));
  },
  { permission: "catalog.edit", errorStatus: 400 },
);
