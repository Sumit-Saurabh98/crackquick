import { NextResponse } from "next/server";
import { adminOverview } from "@/lib/overview";
import { MANAGEMENT, requireAnyPermission, route } from "@/lib/viewer";

/** Admin dashboard numbers; any management permission (catalog, submissions or users). */
export const GET = route(async (_req, { viewer }) => {
  requireAnyPermission(viewer, MANAGEMENT);
  return NextResponse.json(await adminOverview(viewer));
});
