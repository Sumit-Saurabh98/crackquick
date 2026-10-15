import type { Extensions } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Youtube from "@tiptap/extension-youtube";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

/**
 * The note schema, shared by the editor and the read view so both understand the same content. The
 * read view renders through this schema too, so anything it doesn't know (scripts, raw HTML) is dropped.
 */
export function noteExtensions({ editable }: { editable: boolean }): Extensions {
  const base: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: !editable, autolink: true, defaultProtocol: "https" },
    }),
    TextStyleKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Image.configure({ resize: editable ? { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 80 } : false }),
    Youtube.configure({ nocookie: true, width: 640, height: 360 }),
    TableKit.configure({ table: { resizable: editable } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Subscript,
    Superscript,
  ];
  if (!editable) return base;
  return [...base, Placeholder.configure({ placeholder: "Start writing… paste or drop images straight in." }), CharacterCount];
}

/** An empty document. */
export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
