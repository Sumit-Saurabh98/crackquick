import { NextResponse } from "next/server";
import { checkId } from "@/lib/http";
import { deleteOption, renameOption } from "@/lib/options";
import { route } from "@/lib/viewer";

type P = { id: string };

/** Needs lists.manage. Rename: body { name }. Questions using the old name are updated too. */
export const PATCH = route<P>(
  async (req, { params }) => {
    const body = await req.json();
    return NextResponse.json(await renameOption(checkId(params.id, "Option not found."), body.name));
  },
  { permission: "lists.manage", errorStatus: 400 },
);

/** Needs lists.manage. Delete: questions using it are left with that field empty. */
export const DELETE = route<P>(
  async (_req, { params }) => NextResponse.json(await deleteOption(checkId(params.id, "Option not found."))),
  { permission: "lists.manage" },
);
