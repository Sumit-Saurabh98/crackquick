import { NextResponse } from "next/server";
import { addPlaylist, listPlaylists } from "@/lib/playlists";
import { route } from "@/lib/viewer";

/** The viewer's playlists → { items: [{ id, name, url }] } */
export const GET = route(async (_req, { viewer }) => NextResponse.json({ items: await listPlaylists(viewer.id) }));

/** Add one. Body: { name, url } */
export const POST = route(
  async (req, { viewer }) => NextResponse.json({ items: await addPlaylist(viewer.id, await req.json()) }, { status: 201 }),
  { errorStatus: 400 },
);
