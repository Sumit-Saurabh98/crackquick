import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { dbConnect } from "@/lib/mongodb";
import { deletePlaylist, updatePlaylist } from "@/lib/playlists";

type Ctx = { params: Promise<{ id: string }> };

/** Edit one. Body: { name, url } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await dbConnect();
    return NextResponse.json({ items: await updatePlaylist(id, await req.json()) });
  } catch (e) {
    return fail(e, 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await dbConnect();
    return NextResponse.json({ items: await deletePlaylist(id) });
  } catch (e) {
    return fail(e);
  }
}
