import { NextResponse } from "next/server";
import { healthReport } from "@/lib/health";
import { route } from "@/lib/viewer";

/** Needs catalog.edit. What's missing or broken in the live catalog. */
export const GET = route(async () => NextResponse.json(await healthReport()), { permission: "catalog.edit" });
