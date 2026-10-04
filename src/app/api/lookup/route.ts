import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { lookupProblems } from "@/lib/platforms";
import { canonicalProblemUrl } from "@/lib/problemUrl";
import { Question } from "@/models/Question";

/**
 * Body: { platform: "leetcode" | "gfg", input: "1, 15, 146-150, two-sum, https://..., LRU Cache" }
 * Fetches problem details from the platform and flags ones already in the library.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const platform = body.platform === "gfg" ? "gfg" : "leetcode";
    let result;
    try {
      result = await lookupProblems(platform, String(body.input ?? ""));
    } catch (e) {
      const site = platform === "gfg" ? "GeeksforGeeks" : "LeetCode";
      return fail(new Error(`Couldn't reach ${site}: ${e instanceof Error ? e.message : String(e)}`), 502);
    }

    await dbConnect();
    // Compare canonical links so older ".../description/" style URLs still count as duplicates.
    const existing = await Question.find({ platformUrl: { $ne: "" } }, { platformUrl: 1 }).lean();
    const have = new Map(existing.map((q) => [canonicalProblemUrl(String(q.platformUrl)), String(q._id)]));
    return NextResponse.json({
      items: result.items.map((p) => ({ ...p, existingId: have.get(p.platformUrl) ?? null })),
      errors: result.errors,
    });
  } catch (e) {
    return fail(e, 400);
  }
}
