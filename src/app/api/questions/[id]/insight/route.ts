import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { questionInsight } from "@/lib/insight";
import { videoLinks } from "@/lib/serialize";
import { route } from "@/lib/viewer";
import { Question } from "@/models/Question";

/** Needs catalog.edit. Everyone's progress on this question as totals, with hints for the catalog. */
export const GET = route<{ id: string }>(
  async (_req, { params }) => {
    const q = await Question.findById(checkId(params.id, "Question not found")).lean();
    if (!q) throw new HttpError("Question not found", 404);
    return NextResponse.json(await questionInsight(params.id, String(q.difficulty), videoLinks(q as Record<string, unknown>).length > 0));
  },
  { permission: "catalog.edit" },
);
