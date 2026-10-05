import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { movePlaylist } from "@/lib/playlists";

/** Body: { dir: -1 (up) | 1 (down) } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { dir } = await req.json();
    await dbConnect();
    return NextResponse.json({ items: await movePlaylist(id, dir === -1 ? -1 : 1) });
  } catch (e) {
    return fail(e, 400);
  }
}
