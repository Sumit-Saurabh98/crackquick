import { NextResponse } from "next/server";
import { revertEntry } from "@/lib/audit";
import { checkId } from "@/lib/http";
import { route } from "@/lib/viewer";

/** Needs catalog.edit. Undoes one recorded change (see `revertEntry`). */
export const POST = route<{ id: string }>(
  async (_req, { viewer, params }) => {
    const q = await revertEntry(viewer, checkId(params.id, "Change not found"));
    return NextResponse.json({ ok: true, questionId: String(q._id) });
  },
  { permission: "catalog.edit", errorStatus: 400 },
);
