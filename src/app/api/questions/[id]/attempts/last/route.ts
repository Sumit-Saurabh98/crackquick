import { NextResponse } from "next/server";
import { undoLastAttempt } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { route } from "@/lib/viewer";

/** Undo last log: removes the viewer's latest attempt and restores their previous schedule. */
export const DELETE = route<{ id: string }>(
  async (_req, { viewer, params }) => {
    checkId(params.id, "Question not found");
    return NextResponse.json(await undoLastAttempt(viewer.id, params.id));
  },
  { errorStatus: 400 },
);
