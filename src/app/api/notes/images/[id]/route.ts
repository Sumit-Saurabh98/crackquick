import { HttpError } from "@/lib/attempts";
import { checkId } from "@/lib/http";
import { route } from "@/lib/viewer";
import { NoteImage } from "@/models/NoteImage";

type P = { id: string };

/**
 * Serves an uploaded image to the user who uploaded it. Images never change, so browsers may cache
 * them for a year. SVGs are sandboxed: scripts in them can't run even if the file is opened directly.
 */
export const GET = route<P>(async (_req, { viewer, params }) => {
  const img = await NoteImage.findOne({ _id: checkId(params.id, "Image not found"), uploadedBy: viewer.id });
  if (!img) throw new HttpError("Image not found", 404);
  return new Response(Uint8Array.from(img.data), {
    headers: {
      "Content-Type": img.contentType,
      "Content-Length": String(img.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
