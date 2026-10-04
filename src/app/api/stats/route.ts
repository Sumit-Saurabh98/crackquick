import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { computeStats } from "@/lib/stats";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const period = req.nextUrl.searchParams.get("period") || "day";
    const stats = await computeStats(period);
    return NextResponse.json(stats);
  } catch (e) {
    return fail(e);
  }
}
