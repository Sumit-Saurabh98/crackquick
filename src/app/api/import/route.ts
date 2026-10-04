import { NextRequest, NextResponse } from "next/server";
import { DIFFICULTIES } from "@/lib/constants";
import { csv, fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { ensureOptions } from "@/lib/options";
import { canonicalProblemUrl } from "@/lib/problemUrl";
import { Question } from "@/models/Question";

type Incoming = Record<string, unknown>;

function normalize(raw: Incoming, pattern: string) {
  const title = String(raw.title ?? "").trim();
  if (!title) return null;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(String(raw.difficulty))
    ? String(raw.difficulty)
    : "Medium";
  return {
    title,
    platform: String(raw.platform ?? "LeetCode"),
    platformUrl: raw.platformUrl ? canonicalProblemUrl(String(raw.platformUrl)) : "",
    externalId: String(raw.externalId ?? ""),
    videoUrl: String(raw.videoUrl ?? ""),
    notes: String(raw.notes ?? ""),
    topics: csv(raw.topics),
    companies: csv(raw.companies),
    difficulty,
    pattern: pattern || String(raw.pattern ?? ""),
    isStarred: Boolean(raw.isStarred),
    status: "todo",
  };
}

/**
 * Body: `{ questions: [...], pattern? }` (an exported file's `questions` works too, or a bare array).
 * Imports question definitions only (no history); skips duplicates by platform link, else title.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const rows: Incoming[] | null = Array.isArray(body) ? body : Array.isArray(body.questions) ? body.questions : null;
    if (!rows) return fail(new Error("Expected { questions: [...] }."), 400);
    const pattern = typeof body.pattern === "string" ? body.pattern.trim() : "";

    const existing = await Question.find({}, { title: 1, platformUrl: 1 }).lean();
    const urls = new Set(
      existing.map((q) => (q.platformUrl ? canonicalProblemUrl(String(q.platformUrl)).toLowerCase() : "")).filter(Boolean),
    );
    const titles = new Set(existing.map((q) => String(q.title).toLowerCase()));

    const fresh = [];
    let skipped = 0;
    for (const raw of rows) {
      const q = normalize(raw, pattern);
      if (!q) {
        skipped += 1;
        continue;
      }
      const url = q.platformUrl.toLowerCase();
      if ((url && urls.has(url)) || (!url && titles.has(q.title.toLowerCase()))) {
        skipped += 1;
        continue;
      }
      if (url) urls.add(url);
      titles.add(q.title.toLowerCase());
      fresh.push(q);
    }
    const created = fresh.length ? await Question.insertMany(fresh) : [];
    await Promise.all([
      ensureOptions("platform", fresh.map((q) => q.platform)),
      ensureOptions("pattern", fresh.map((q) => q.pattern)),
    ]);
    return NextResponse.json({ imported: created.length, skipped });
  } catch (e) {
    return fail(e, 400);
  }
}
