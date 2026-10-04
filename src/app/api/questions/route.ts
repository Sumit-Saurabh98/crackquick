import { NextRequest, NextResponse } from "next/server";
import { logAttempt, parseAttemptInput } from "@/lib/attempts";
import { csv, fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { canonicalProblemUrl } from "@/lib/problemUrl";
import { listQuestions } from "@/lib/queries";
import { serializeQuestion } from "@/lib/serialize";
import { Question } from "@/models/Question";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    return NextResponse.json(await listQuestions(req.nextUrl.searchParams));
  } catch (e) {
    return fail(e);
  }
}

/** Body may include `backfill: { solvedAt, confidence }` to record a solve done before using the app. */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const backfill = body.backfill ? parseAttemptInput({ ...body.backfill, outcome: "recalled" }) : null;
    if (backfill && !backfill.solvedAt) throw Object.assign(new Error("backfill.solvedAt is required"), { status: 400 });

    const created = await Question.create({
      title: body.title,
      platform: body.platform,
      platformUrl: body.platformUrl ? canonicalProblemUrl(String(body.platformUrl)) : "",
      externalId: body.externalId ? String(body.externalId) : "",
      videoUrl: body.videoUrl,
      notes: body.notes,
      topics: csv(body.topics),
      companies: csv(body.companies),
      difficulty: body.difficulty || "Medium",
      status: body.status === "in_progress" ? "in_progress" : "todo",
      sourceList: body.sourceList,
      isStarred: Boolean(body.isStarred),
    });
    if (backfill) {
      const { item } = await logAttempt(String(created._id), backfill);
      return NextResponse.json({ item }, { status: 201 });
    }
    return NextResponse.json({ item: serializeQuestion(created.toObject()) }, { status: 201 });
  } catch (e) {
    return fail(e, 400);
  }
}
