import { NextRequest, NextResponse } from "next/server";
import { undoLastAttempt } from "@/lib/attempts";
import { fail, notFoundUnlessValidId } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";

/** Undo last log: removes the latest attempt and restores the previous schedule. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    return NextResponse.json(await undoLastAttempt(id));
  } catch (e) {
    return fail(e, 400);
  }
}
