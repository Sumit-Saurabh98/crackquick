import { NextResponse } from "next/server";
import { serializeAudit } from "@/lib/audit";
import { checkId } from "@/lib/http";
import { route } from "@/lib/viewer";
import { AuditEntry } from "@/models/AuditEntry";

const PAGE = 50;

/** Needs catalog.edit. Newest first. ?questionId= for one question; ?page= (50 per page). */
export const GET = route(
  async (req) => {
    const search = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = {};
    const qid = search.get("questionId");
    if (qid) filter.questionId = checkId(qid, "Question not found");
    const page = Math.max(1, Number(search.get("page")) || 1);
    const [docs, total] = await Promise.all([
      AuditEntry.find(filter).sort({ at: -1, _id: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
      AuditEntry.countDocuments(filter),
    ]);
    return NextResponse.json({
      items: docs.map((d) => serializeAudit(d as Record<string, unknown>)),
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
    });
  },
  { permission: "catalog.edit" },
);
