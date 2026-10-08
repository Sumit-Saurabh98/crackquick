import { NextResponse } from "next/server";
import { movePlaylist } from "@/lib/playlists";
import { route } from "@/lib/viewer";

/** Body: { dir: -1 (up) | 1 (down) } */
export const POST = route<{ id: string }>(
  async (req, { viewer, params }) => {
    const { dir } = await req.json();
    return NextResponse.json({ items: await movePlaylist(viewer.id, params.id, dir === -1 ? -1 : 1) });
  },
  { errorStatus: 400 },
);
