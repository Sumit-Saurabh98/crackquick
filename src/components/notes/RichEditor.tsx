"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/noteTypes";
import { EMPTY_DOC, noteExtensions } from "./extensions";

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  return (await api<{ url: string }>("/api/notes/images", { method: "POST", body })).url;
}

/**
 * The note editor and its upload state. Images pasted, dropped or picked are uploaded first and then
 * inserted (never kept inline as base64, which would bloat the note).
 */
export function useNoteEditor(initial: Record<string, unknown> | null, onChange: () => void) {
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const extensions = useMemo(() => noteExtensions({ editable: true }), []);
  const editorRef = useRef<Editor | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });

  async function insertImages(files: File[], pos?: number) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return false;
    setUploadError("");
    for (const file of images) {
      if (!IMAGE_TYPES[file.type]) {
        setUploadError("Use a PNG, JPEG, GIF, WebP or SVG image.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError(`${file.name} is over 3 MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const src = await uploadImage(file);
        const ed = editorRef.current;
        if (!ed) continue;
        const node = { type: "image", attrs: { src, alt: file.name.replace(/\.[^.]+$/, "") } };
        if (pos === undefined) ed.chain().focus().insertContent(node).run();
        else ed.chain().focus().insertContentAt(pos, node).run();
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    return true;
  }
  const insertRef = useRef(insertImages);
  useEffect(() => {
    insertRef.current = insertImages;
  });

  const editor = useEditor({
    extensions,
    content: initial ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text rich-editor", "aria-label": "Note" },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.some((f) => f.type.startsWith("image/"))) return false;
        void insertRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = [...(event.dataTransfer?.files ?? [])];
        if (!files.some((f) => f.type.startsWith("image/"))) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertRef.current(files, at);
        return true;
      },
    },
    onUpdate: () => changeRef.current(),
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  return { editor, uploading: uploading > 0, uploadError, insertImages };
}

/** The toolbar and writing area. */
export function RichEditor({ note }: { note: ReturnType<typeof useNoteEditor> }) {
  const { editor } = note;
  if (!editor) return <div className="card min-h-[60vh] animate-pulse" />;
  return (
    <div className="card">
      <Toolbar editor={editor} note={note} />
      <div className="px-5 py-4 sm:px-8 sm:py-6">
        <EditorContent editor={editor} />
      </div>
      <Footer editor={editor} note={note} />
    </div>
  );
}

function Footer({ editor, note }: { editor: Editor; note: ReturnType<typeof useNoteEditor> }) {
  const words = useEditorState({ editor, selector: ({ editor: e }) => e.storage.characterCount?.words() ?? 0 });
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-xs text-muted">
      <span>{words.toLocaleString()} words</span>
      {note.uploading ? (
        <span className="flex items-center gap-1.5 text-brass2">
          <span className="spinner spinner-sm" /> Uploading image…
        </span>
      ) : null}
      {note.uploadError ? <span className="text-warn">{note.uploadError}</span> : null}
      <span className="ml-auto hidden sm:inline">Tip: paste or drag images in · ⌘S saves</span>
    </div>
  );
}

const BLOCKS = [
  { value: "p", label: "Paragraph" },
  { value: "1", label: "Heading 1" },
  { value: "2", label: "Heading 2" },
  { value: "3", label: "Heading 3" },
  { value: "4", label: "Heading 4" },
  { value: "5", label: "Heading 5" },
  { value: "6", label: "Heading 6" },
] as const;

const FONTS = [
  { value: "", label: "Default font" },
  { value: "var(--font-fraunces), Georgia, serif", label: "Serif" },
  { value: "var(--font-geist-mono), monospace", label: "Monospace" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "'Times New Roman', Times, serif", label: "Times" },
  { value: "'Courier New', Courier, monospace", label: "Courier" },
  { value: "'Comic Sans MS', 'Comic Sans', cursive", label: "Comic Sans" },
];

const SIZES = ["", "12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px", "48px"];

const TEXT_COLORS = ["#e8edf4", "#8b97a8", "#e0b366", "#f0d9a8", "#3dba8b", "#7dcea0", "#5fa8e0", "#a78bfa", "#e879b0", "#e07a5f", "#ef4444", "#facc15"];
const HIGHLIGHTS = ["#e0b36655", "#3dba8b55", "#5fa8e055", "#a78bfa55", "#e879b055", "#e07a5f55", "#facc1555", "#8b97a855"];

type ToolProps = { on?: boolean; label: ReactNode; title: string; run: () => void; disabled?: boolean };

/** One toolbar button. mousedown is cancelled so the editor keeps its selection. */
function Tool({ on, label, title, run, disabled }: ToolProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-sm hover:bg-white/10 disabled:opacity-40 ${on ? "bg-brass/20 text-brass2" : "text-ink"}`}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-line" aria-hidden />;
}

/** A button that opens a small panel below it; closes on outside click or Escape. */
function Popover({ label, title, children }: { label: ReactNode; title: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Tool title={title} label={label} on={open} run={() => setOpen((o) => !o)} />
      {open ? <div className="card absolute left-0 top-9 z-30 grid w-60 gap-2 p-3 text-sm shadow-xl">{children(() => setOpen(false))}</div> : null}
    </div>
  );
}

function Swatches({ colors, current, onPick }: { colors: string[]; current?: string; onPick: (c: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`Colour ${c}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className={`size-7 rounded-md border ${current === c ? "border-ink" : "border-line"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

/** A one-field form inside a popover (link and video URLs). */
function UrlForm({ initial, placeholder, submit, remove }: { initial: string; placeholder: string; submit: (url: string) => string | void; remove?: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(submit(value.trim()) || "");
      }}
    >
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="field" inputMode="url" />
      {error ? <p className="text-xs text-warn">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {remove ? (
          <button type="button" onClick={remove} className="btn btn-sm">
            Remove
          </button>
        ) : null}
        <button className="btn-primary btn-sm">Apply</button>
      </div>
    </form>
  );
}

function Toolbar({ editor, note }: { editor: Editor; note: ReturnType<typeof useNoteEditor> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const style = e.getAttributes("textStyle");
      const level = ([1, 2, 3, 4, 5, 6] as const).find((l) => e.isActive("heading", { level: l }));
      return {
        block: level ? String(level) : "p",
        font: String(style.fontFamily ?? ""),
        size: String(style.fontSize ?? ""),
        color: style.color as string | undefined,
        highlight: e.getAttributes("highlight").color as string | undefined,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        code: e.isActive("code"),
        sub: e.isActive("subscript"),
        sup: e.isActive("superscript"),
        left: e.isActive({ textAlign: "left" }),
        center: e.isActive({ textAlign: "center" }),
        right: e.isActive({ textAlign: "right" }),
        justify: e.isActive({ textAlign: "justify" }),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        task: e.isActive("taskList"),
        quote: e.isActive("blockquote"),
        codeBlock: e.isActive("codeBlock"),
        link: e.isActive("link"),
        href: String(e.getAttributes("link").href ?? ""),
        table: e.isActive("table"),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const c = () => editor.chain().focus();
  const setBlock = (v: string) => (v === "p" ? c().setParagraph().run() : c().setHeading({ level: Number(v) as 1 | 2 | 3 | 4 | 5 | 6 }).run());

  return (
    <div
      className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-line bg-bg2/95 p-1.5 backdrop-blur"
      role="toolbar"
      aria-label="Formatting"
    >
      <select aria-label="Text style" value={s.block} onChange={(e) => setBlock(e.target.value)} className="field h-8 w-32 py-0 text-xs">
        {BLOCKS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Font"
        value={FONTS.some((f) => f.value === s.font) ? s.font : ""}
        onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}
        className="field h-8 w-32 py-0 text-xs"
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Font size"
        value={SIZES.includes(s.size) ? s.size : ""}
        onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
        className="field h-8 w-24 py-0 text-xs"
      >
        {SIZES.map((v) => (
          <option key={v} value={v}>
            {v ? v.replace("px", "") : "Size"}
          </option>
        ))}
      </select>
      <Sep />
      <Tool title="Bold (⌘B)" label={<b>B</b>} on={s.bold} run={() => c().toggleBold().run()} />
      <Tool title="Italic (⌘I)" label={<i className="display">I</i>} on={s.italic} run={() => c().toggleItalic().run()} />
      <Tool title="Underline (⌘U)" label={<u>U</u>} on={s.underline} run={() => c().toggleUnderline().run()} />
      <Tool title="Strikethrough" label={<s>S</s>} on={s.strike} run={() => c().toggleStrike().run()} />
      <Tool title="Inline code" label={<code className="text-xs">{"</>"}</code>} on={s.code} run={() => c().toggleCode().run()} />
      <Tool title="Subscript" label={<span>x<sub>2</sub></span>} on={s.sub} run={() => c().toggleSubscript().run()} />
      <Tool title="Superscript" label={<span>x<sup>2</sup></span>} on={s.sup} run={() => c().toggleSuperscript().run()} />
      <Popover
        title="Text colour"
        label={
          <span className="grid leading-none">
            A<span className="mt-0.5 h-1 w-4 rounded-sm" style={{ background: s.color ?? "var(--ink)" }} />
          </span>
        }
      >
        {(close) => (
          <>
            <p className="eyebrow">Text colour</p>
            <Swatches colors={TEXT_COLORS} current={s.color} onPick={(col) => (c().setColor(col).run(), close())} />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                Custom
                <input type="color" value={s.color?.startsWith("#") ? s.color.slice(0, 7) : "#e0b366"} onChange={(e) => c().setColor(e.target.value).run()} />
              </label>
              <button type="button" className="btn btn-sm ml-auto" onClick={() => (c().unsetColor().run(), close())}>
                Default
              </button>
            </div>
          </>
        )}
      </Popover>
      <Popover
        title="Highlight"
        label={
          <span className="rounded px-1" style={{ background: s.highlight ?? "#e0b36655" }}>
            H
          </span>
        }
      >
        {(close) => (
          <>
            <p className="eyebrow">Highlight</p>
            <Swatches colors={HIGHLIGHTS} current={s.highlight} onPick={(col) => (c().setHighlight({ color: col }).run(), close())} />
            <button type="button" className="btn btn-sm justify-self-end" onClick={() => (c().unsetHighlight().run(), close())}>
              None
            </button>
          </>
        )}
      </Popover>
      <Sep />
      <Tool title="Align left" label="⇤" on={s.left} run={() => c().setTextAlign("left").run()} />
      <Tool title="Align centre" label="↔" on={s.center} run={() => c().setTextAlign("center").run()} />
      <Tool title="Align right" label="⇥" on={s.right} run={() => c().setTextAlign("right").run()} />
      <Tool title="Justify" label="☰" on={s.justify} run={() => c().setTextAlign("justify").run()} />
      <Sep />
      <Tool title="Bulleted list" label="•≡" on={s.bullet} run={() => c().toggleBulletList().run()} />
      <Tool title="Numbered list" label="1≡" on={s.ordered} run={() => c().toggleOrderedList().run()} />
      <Tool title="Checklist" label="☑" on={s.task} run={() => c().toggleTaskList().run()} />
      <Tool title="Quote" label="❝" on={s.quote} run={() => c().toggleBlockquote().run()} />
      <Tool title="Code block" label="{ }" on={s.codeBlock} run={() => c().toggleCodeBlock().run()} />
      <Tool title="Divider" label="―" run={() => c().setHorizontalRule().run()} />
      <Sep />
      <Popover title="Link" label="🔗">
        {(close) => (
          <UrlForm
            initial={s.href}
            placeholder="https://example.com"
            remove={s.link ? () => (c().extendMarkRange("link").unsetLink().run(), close()) : undefined}
            submit={(url) => {
              if (!url) return "Enter a link.";
              const href = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/") ? url : `https://${url}`;
              if (!/^(https?:|mailto:|\/)/i.test(href)) return "Use an http(s) or mailto link.";
              if (editor.state.selection.empty && !s.link) c().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href } }] }).run();
              else c().extendMarkRange("link").setLink({ href }).run();
              close();
            }}
          />
        )}
      </Popover>
      <Tool title="Upload image" label={note.uploading ? <span className="spinner spinner-sm" /> : "🖼"} run={() => fileInput.current?.click()} />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={Object.keys(IMAGE_TYPES).join(",")}
        className="hidden"
        onChange={(e) => {
          void note.insertImages([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <Popover title="YouTube video" label="▶">
        {(close) => (
          <UrlForm
            initial=""
            placeholder="https://youtube.com/watch?v=…"
            submit={(url) => {
              if (!c().setYoutubeVideo({ src: url }).run()) return "That isn't a YouTube video link.";
              close();
            }}
          />
        )}
      </Popover>
      <Tool title="Insert table" label="▦" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <Sep />
      <Tool title="Clear formatting" label="⌫" run={() => c().unsetAllMarks().clearNodes().run()} />
      <Tool title="Undo (⌘Z)" label="↶" disabled={!s.canUndo} run={() => c().undo().run()} />
      <Tool title="Redo (⇧⌘Z)" label="↷" disabled={!s.canRedo} run={() => c().redo().run()} />
      {s.table ? (
        <div className="flex w-full flex-wrap items-center gap-1 border-t border-line pt-1.5 text-xs">
          <span className="eyebrow mr-1">Table</span>
          {(
            [
              ["Row above", () => c().addRowBefore().run()],
              ["Row below", () => c().addRowAfter().run()],
              ["Column left", () => c().addColumnBefore().run()],
              ["Column right", () => c().addColumnAfter().run()],
              ["Delete row", () => c().deleteRow().run()],
              ["Delete column", () => c().deleteColumn().run()],
              ["Header row", () => c().toggleHeaderRow().run()],
              ["Merge / split", () => c().mergeOrSplit().run()],
              ["Delete table", () => c().deleteTable().run()],
            ] as const
          ).map(([label, run]) => (
            <button key={label} type="button" onMouseDown={(e) => e.preventDefault()} onClick={run} className="chip hover:text-ink">
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
