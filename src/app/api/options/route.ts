import { NextResponse } from "next/server";
import { createOption, listOptions, parseKind } from "@/lib/options";
import { route } from "@/lib/viewer";

/** GET ?kind=platform|pattern → { items: [{ _id, name, count }] } */
export const GET = route(async (req) =>
  NextResponse.json({ items: await listOptions(parseKind(req.nextUrl.searchParams.get("kind"))) }),
);

/** Needs lists.manage. Body: { kind, name } */
export const POST = route(
  async (req) => {
    const body = await req.json();
    return NextResponse.json({ item: await createOption(parseKind(body.kind), body.name) }, { status: 201 });
  },
  { permission: "lists.manage", errorStatus: 400 },
);
