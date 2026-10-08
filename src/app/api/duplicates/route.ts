import { NextResponse } from "next/server";
import { findDuplicates } from "@/lib/duplicates";
import { route } from "@/lib/viewer";

/** Needs catalog.edit. Likely duplicate pairs, best match first. */
export const GET = route(async () => NextResponse.json({ items: await findDuplicates() }), { permission: "catalog.edit" });
