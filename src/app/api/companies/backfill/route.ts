import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { fromGfg, gfgDetail, leetcodeCompanies } from "@/lib/platforms";
import { parseProblemUrl } from "@/lib/problemUrl";
import { Question } from "@/models/Question";

/** Fills company tags on LeetCode / GFG questions that have none (e.g. imported before tags were supported). */
export async function POST() {
  try {
    await dbConnect();
    const docs = await Question.find(
      { $or: [{ companies: { $size: 0 } }, { companies: { $exists: false } }], platformUrl: { $ne: "" } },
      { platformUrl: 1 },
    ).lean();

    const updates: { id: unknown; companies: string[] }[] = [];
    const gfg: { id: unknown; slug: string }[] = [];
    for (const d of docs) {
      const parsed = parseProblemUrl(String(d.platformUrl));
      if (!parsed?.slug) continue;
      if (parsed.platform === "LeetCode") {
        const companies = leetcodeCompanies(parsed.slug);
        if (companies.length) updates.push({ id: d._id, companies });
      } else if (parsed.platform === "GeeksforGeeks") {
        gfg.push({ id: d._id, slug: parsed.slug });
      }
    }
    for (let i = 0; i < gfg.length; i += 6) {
      const batch = await Promise.all(gfg.slice(i, i + 6).map(async (g) => ({ g, hit: await gfgDetail(g.slug) })));
      for (const { g, hit } of batch) {
        const companies = hit ? fromGfg(hit).companies : [];
        if (companies.length) updates.push({ id: g.id, companies });
      }
    }

    if (updates.length) {
      await Question.bulkWrite(
        updates.map((u) => ({ updateOne: { filter: { _id: u.id }, update: { $set: { companies: u.companies } } } })),
      );
    }
    return NextResponse.json({ checked: docs.length, updated: updates.length });
  } catch (e) {
    return fail(e);
  }
}
