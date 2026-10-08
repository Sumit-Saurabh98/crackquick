import { NextResponse } from "next/server";
import { questionFacets } from "@/lib/queries";
import { route } from "@/lib/viewer";

export const GET = route(async () => NextResponse.json(await questionFacets()));
