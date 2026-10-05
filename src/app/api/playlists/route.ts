import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { addPlaylist, listPlaylists } from "@/lib/playlists";

/** → { items: [{ id, name, url }] } */
export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ items: await listPlaylists() });
  } catch (e) {
    return fail(e);
  }
}

/** Add one. Body: { name, url } */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    return NextResponse.json({ items: await addPlaylist(await req.json()) }, { status: 201 });
  } catch (e) {
    return fail(e, 400);
  }
}
