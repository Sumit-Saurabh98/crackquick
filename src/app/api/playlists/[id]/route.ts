import { NextResponse } from "next/server";
import { deletePlaylist, updatePlaylist } from "@/lib/playlists";
import { route } from "@/lib/viewer";

type P = { id: string };

/** Edit one. Body: { name, url } */
export const PATCH = route<P>(
  async (req, { viewer, params }) =>
    NextResponse.json({ items: await updatePlaylist(viewer.id, params.id, await req.json()) }),
  { permission: "practice.track", errorStatus: 400 },
);

export const DELETE = route<P>(
  async (_req, { viewer, params }) => NextResponse.json({ items: await deletePlaylist(viewer.id, params.id) }),
  { permission: "practice.track" },
);
