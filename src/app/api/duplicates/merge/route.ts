import { NextResponse } from "next/server";
import { mergeQuestions } from "@/lib/duplicates";
import { requirePermission, route } from "@/lib/viewer";

/** Needs catalog.edit and catalog.delete. Body: { keepId, dropId }. */
export const POST = route(
  async (req, { viewer }) => {
    requirePermission(viewer, "catalog.delete");
    const { keepId, dropId } = await req.json();
    return NextResponse.json(await mergeQuestions(viewer, String(keepId ?? ""), String(dropId ?? "")));
  },
  { permission: "catalog.edit", errorStatus: 400 },
);
