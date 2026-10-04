import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { questionFacets } from "@/lib/queries";

export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json(await questionFacets());
  } catch (e) {
    return fail(e);
  }
}
