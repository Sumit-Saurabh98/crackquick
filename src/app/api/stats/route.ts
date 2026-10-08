import { NextResponse } from "next/server";
import { computeStats } from "@/lib/stats";
import { route } from "@/lib/viewer";

export const GET = route(
  async (req, { viewer }) => NextResponse.json(await computeStats(viewer, req.nextUrl.searchParams.get("period") || "day")),
  { permission: "practice.track" },
);
