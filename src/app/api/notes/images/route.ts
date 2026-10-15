import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/noteTypes";
import { consume } from "@/lib/rateLimit";
import { route } from "@/lib/viewer";
import { NoteImage } from "@/models/NoteImage";

/** Uploads one image (multipart field `file`) for a note: PNG, JPEG, GIF, WebP or SVG, up to 3 MB. */
export const POST = route(
  async (req, { viewer }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError("Send the image as a file.", 400);
    if (!IMAGE_TYPES[file.type]) throw new HttpError("Use a PNG, JPEG, GIF, WebP or SVG image.", 400);
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError("Images can be up to 3 MB.", 400);
    await consume(viewer.id, "upload");
    const doc = await NoteImage.create({
      data: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      size: file.size,
      name: file.name.slice(0, 200),
      uploadedBy: viewer.id,
    });
    return NextResponse.json({ url: `/api/notes/images/${doc._id}` }, { status: 201 });
  },
  { errorStatus: 400 },
);
