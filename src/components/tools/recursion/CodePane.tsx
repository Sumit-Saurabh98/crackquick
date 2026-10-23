"use client";

import { useEffect, useRef, useState } from "react";

const LINE = 21; // px, matches leading-5.25
const PAD = 12;

/**
 * A plain code box with line numbers and a highlight bar on `line`: where the current call was made
 * (gold) or where control goes back to after a return (blue).
 */
export function CodePane({
  value,
  onChange,
  onRun,
  line,
  tone,
  indent,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  line: number | null;
  tone: "call" | "back";
  /** One level of indentation: Tab inserts it, and Enter after ":" or "{" adds it. */
  indent: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [scroll, setScroll] = useState(0);
  const count = value.split("\n").length;

  // Keep the highlighted line in view while stepping.
  useEffect(() => {
    const el = area.current;
    if (!el || line === null) return;
    const top = PAD + (line - 1) * LINE;
    if (top < el.scrollTop + 10 || top > el.scrollTop + el.clientHeight - LINE * 2) el.scrollTop = Math.max(0, top - el.clientHeight / 3);
  }, [line]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-bg font-mono text-[13px]">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-11 overflow-hidden border-r border-line bg-bg2/60 text-right text-muted/60">
        <div style={{ transform: `translateY(${PAD - scroll}px)` }}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className={`pr-2 leading-5.25 ${line === i + 1 ? (tone === "call" ? "text-brass" : "text-sky-300") : ""}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      {line !== null ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute left-11 right-0 border-l-2 transition-[top] duration-200 ${
            tone === "call" ? "border-brass bg-brass/15" : "border-sky-400 bg-sky-400/15"
          }`}
          style={{ top: PAD + (line - 1) * LINE - scroll, height: LINE }}
        />
      ) : null}
      <textarea
        ref={area}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onRun();
          } else if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            el.setRangeText(indent, el.selectionStart, el.selectionEnd, "end");
            onChange(el.value);
          } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
            // Keep the current line's indentation, one level deeper after a block opener.
            e.preventDefault();
            const el = e.currentTarget;
            const before = el.value.slice(0, el.selectionStart);
            const lineText = before.slice(before.lastIndexOf("\n") + 1);
            const lead = /^[ \t]*/.exec(lineText)?.[0] ?? "";
            const opens = /[:{[(]\s*$/.test(lineText);
            el.setRangeText("\n" + lead + (opens ? indent : ""), el.selectionStart, el.selectionEnd, "end");
            onChange(el.value);
          }
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label="Your code"
        // Inline so the global `font: inherit` on form fields can't change it: rows must match the gutter.
        style={{ lineHeight: `${LINE}px`, fontSize: 13 }}
        className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-3 pr-3 pl-14 font-mono text-ink caret-brass outline-none tab-2"
      />
    </div>
  );
}
