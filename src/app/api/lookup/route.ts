import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { lookupProblems } from "@/lib/platforms";
import { canonicalProblemUrl } from "@/lib/problemUrl";
import { can, route } from "@/lib/viewer";
import { Question } from "@/models/Question";

/**
 * Body: { platform: "leetcode" | "gfg", input: "1, 15, 146-150, two-sum, https://..., LRU Cache" }
 * Fetches problem details from the platform and flags ones already in the catalog. Catalog editors
 * look up to 100 at once; everyone else one (they can only suggest one question at a time).
 */
export const POST = route(
  async (req, { viewer }) => {
    const body = await req.json();
    const platform = body.platform === "gfg" ? "gfg" : "leetcode";
    let result;
    try {
      result = await lookupProblems(platform, String(body.input ?? ""), can(viewer, "catalog.edit") ? undefined : 1);
    } catch (e) {
      const site = platform === "gfg" ? "GeeksforGeeks" : "LeetCode";
      return fail(new Error(`Couldn't reach ${site}: ${e instanceof Error ? e.message : String(e)}`), 502);
    }

    // Compare canonical links so older ".../description/" style URLs still count as duplicates.
    const existing = await Question.find({ platformUrl: { $ne: "" } }, { platformUrl: 1 }).lean();
    const have = new Map(existing.map((q) => [canonicalProblemUrl(String(q.platformUrl)), String(q._id)]));
    return NextResponse.json({
      items: result.items.map((p) => ({ ...p, existingId: have.get(p.platformUrl) ?? null })),
      errors: result.errors,
    });
  },
  { errorStatus: 400 },
);
