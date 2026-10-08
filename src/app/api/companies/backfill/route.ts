import { NextResponse } from "next/server";
import { fromGfg, gfgDetail, leetcodeCompanies } from "@/lib/platforms";
import { parseProblemUrl } from "@/lib/problemUrl";
import { audit, auditEntry, newBatchId, snapshot } from "@/lib/audit";
import { route } from "@/lib/viewer";
import { Question } from "@/models/Question";

/** Needs catalog.edit. Fills company tags on LeetCode / GFG questions that have none (e.g. imported before tags were supported). */
export const POST = route(
  async (_req, { viewer }) => {
    const docs = await Question.find(
      { $or: [{ companies: { $size: 0 } }, { companies: { $exists: false } }], platformUrl: { $ne: "" } },
      {},
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

    const byId = new Map(docs.map((d) => [String(d._id), d as Record<string, unknown>]));
    const batchId = newBatchId();
    await audit(
      ...updates.map((u) => {
        const doc = byId.get(String(u.id))!;
        return auditEntry(viewer, doc as { _id: unknown }, snapshot(doc), snapshot({ ...doc, companies: u.companies }), {
          source: "backfill",
          batchId,
        });
      }),
    );
    if (updates.length) {
      await Question.bulkWrite(
        updates.map((u) => ({ updateOne: { filter: { _id: u.id }, update: { $set: { companies: u.companies } } } })),
      );
    }
    return NextResponse.json({ checked: docs.length, updated: updates.length });
  },
  { permission: "catalog.edit" },
);
