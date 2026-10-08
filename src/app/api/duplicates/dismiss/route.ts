import { NextResponse } from "next/server";
import { dismissPair } from "@/lib/duplicates";
import { route } from "@/lib/viewer";

/** Needs catalog.edit. Body: { a, b }: marks the pair "not duplicates". */
export const POST = route(
  async (req, { viewer }) => {
    const { a, b } = await req.json();
    await dismissPair(viewer, String(a ?? ""), String(b ?? ""));
    return NextResponse.json({ ok: true });
  },
  { permission: "catalog.edit", errorStatus: 400 },
);
