"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useMemo } from "react";
import { noteExtensions } from "./extensions";

/** A note's document, read-only, styled like the editor. */
export function RichContent({ content }: { content: Record<string, unknown> }) {
  const extensions = useMemo(() => noteExtensions({ editable: false }), []);
  const editor = useEditor(
    {
      extensions,
      content,
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: "rich-text" } },
    },
    [content],
  );
  return <EditorContent editor={editor} />;
}
