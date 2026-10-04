import { NextRequest, NextResponse } from "next/server";
import { logAttempt, parseAttemptInput } from "@/lib/attempts";
import { fail, notFoundUnlessValidId } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { serializeAttempt } from "@/lib/serialize";
import { ActivityEvent } from "@/models/Event";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    const docs = await ActivityEvent.find({ questionId: id }).sort({ at: -1, _id: -1 }).lean();
    return NextResponse.json({ items: docs.map((d) => serializeAttempt(d as Record<string, unknown>)) });
  } catch (e) {
    return fail(e);
  }
}

/** Body: { outcome: "recalled" | "blanked", confidence 1-5, minutes?, mistakes?, solvedAt? } */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const bad = notFoundUnlessValidId(id);
    if (bad) return bad;
    await dbConnect();
    const input = parseAttemptInput(await req.json());
    return NextResponse.json(await logAttempt(id, input));
  } catch (e) {
    return fail(e, 400);
  }
}
