import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { createOption, listOptions, parseKind } from "@/lib/options";

/** GET ?kind=platform|pattern → { items: [{ _id, name, count }] } */
export async function GET(req: NextRequest) {
  try {
    const kind = parseKind(req.nextUrl.searchParams.get("kind"));
    await dbConnect();
    return NextResponse.json({ items: await listOptions(kind) });
  } catch (e) {
    return fail(e);
  }
}

/** Body: { kind, name } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kind = parseKind(body.kind);
    await dbConnect();
    return NextResponse.json({ item: await createOption(kind, body.name) }, { status: 201 });
  } catch (e) {
    return fail(e, 400);
  }
}
