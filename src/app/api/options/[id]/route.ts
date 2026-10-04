import { NextRequest, NextResponse } from "next/server";
import { fail, notFoundUnlessValidId } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { deleteOption, renameOption } from "@/lib/options";

type Ctx = { params: Promise<{ id: string }> };

/** Rename: body { name }. Questions using the old name are updated too. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    const body = await req.json();
    return NextResponse.json(await renameOption(id, body.name));
  } catch (e) {
    return fail(e, 400);
  }
}

/** Delete: questions using it are left with that field empty. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    return NextResponse.json(await deleteOption(id));
  } catch (e) {
    return fail(e);
  }
}
