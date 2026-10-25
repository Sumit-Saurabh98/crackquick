/**
 * Just enough C-family parsing to instrument Java and C++: find function definitions, their
 * parameters and bodies, and the `return` statements inside them. Works on a "masked" copy of the
 * source where comments, string / char literals and preprocessor lines are blanked out (same
 * length, newlines kept), so indexes line up with the original and braces in strings don't count.
 */

export type Edit = { at: number; text: string };

export type FnDef = {
  name: string;
  params: string[];
  /** Index of the body's `{` and its matching `}`. */
  open: number;
  close: number;
  /** A lambda assigned to `name` (C++), not a declared function. */
  lambda: boolean;
  /** For C++ `auto f = [&](auto&& self, …)`: the parameter used to recurse; it isn't shown. */
  selfParam: string | null;
  /** Index of the name, and the (masked) text between the parentheses. */
  nameAt: number;
  paramList: string;
};

const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "sizeof", "new", "delete", "synchronized", "do", "else",
  "try", "throw", "case", "alignof", "decltype", "static_assert", "noexcept", "assert", "super", "this", "typeid",
]);

export function mask(src: string, cpp: boolean): string {
  const out = src.split("");
  const blank = (from: number, to: number) => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== "\n") out[i] = " ";
  };
  let i = 0;
  const n = src.length;
  let lineStart = true;
  while (i < n) {
    const c = src[i];
    if (cpp && lineStart && /^[ \t]*#/.test(src.slice(i, src.indexOf("\n", i) < 0 ? n : src.indexOf("\n", i)))) {
      // preprocessor line (with \ continuations)
      let j = i;
      while (j < n) {
        const e = src.indexOf("\n", j);
        const end = e < 0 ? n : e;
        if (src[end - 1] === "\\" && end < n) j = end + 1;
        else {
          j = end;
          break;
        }
      }
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      const e = src.indexOf("\n", i);
      const end = e < 0 ? n : e;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (cpp && c === "R" && src[i + 1] === '"') {
      // raw string R"delim( … )delim"
      const p = src.indexOf("(", i + 2);
      const delim = src.slice(i + 2, p);
      const end = src.indexOf(`)${delim}"`, p);
      const stop = end < 0 ? n : end + delim.length + 2;
      blank(i + 1, stop);
      i = stop;
      continue;
    }
    if (!cpp && c === '"' && src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3);
      const stop = end < 0 ? n : end + 3;
      blank(i + 1, stop - 1);
      i = stop;
      continue;
    }
    if (c === '"' || (c === "'" && !(cpp && /[0-9A-Fa-f]/.test(src[i - 1] ?? "") && /[0-9A-Fa-f]/.test(src[i + 1] ?? "")))) {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
      lineStart = false;
      continue;
    }
    lineStart = c === "\n" ? true : lineStart && (c === " " || c === "\t");
    i++;
  }
  return out.join("");
}

/** Index of the bracket matching the one at `at` (same kind), or -1. */
export function matching(m: string, at: number): number {
  const open = m[at];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : "";
  let depth = 0;
  for (let i = at; i < m.length; i++) {
    if (m[i] === open) depth++;
    else if (m[i] === close && --depth === 0) return i;
  }
  return -1;
}

/** Splits a parameter list on top-level commas (ignoring those inside <>, (), [], {}). */
export function splitParams(s: string) {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if ("<([{".includes(ch)) depth++;
    else if (">)]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Each parameter as { type, name } (type without the name, default value or annotations). */
export function paramDecls(list: string): { type: string; name: string }[] {
  return splitParams(list)
    .map((p) => {
      const t = p.replace(/=[\s\S]*$/, "").replace(/@\w+(\([^)]*\))?/g, "").replace(/\bfinal\b/g, "").trim();
      const arr = /(\[\s*\])+\s*$/.exec(t); // int a[] → type int[]
      const body = arr ? t.slice(0, arr.index).trim() : t;
      const m = /([A-Za-z_$][\w$]*)\s*$/.exec(body);
      if (!m) return null;
      const type = (body.slice(0, m.index) + (arr ? arr[0].replace(/\s/g, "") : "")).replace(/\s+/g, " ").trim();
      return type ? { type, name: m[1] } : null;
    })
    .filter((d): d is { type: string; name: string } => d !== null);
}

/** The variable name of each parameter (null when unnamed). */
export function paramNames(list: string): (string | null)[] {
  return splitParams(list).map((p) => {
    const t = p
      .replace(/=[\s\S]*$/, "") // C++ default value
      .replace(/@\w+(\([^)]*\))?/g, "") // Java annotations
      .replace(/(\[\s*\w*\s*\])+\s*$/, "") // int a[]
      .trim();
    const m = /([A-Za-z_$][\w$]*)\s*$/.exec(t);
    if (!m) return null;
    // A lone type (unnamed C++ parameter) has no name after it.
    const before = t.slice(0, m.index).trim();
    if (!before || /[,(]$/.test(before)) return null;
    return m[1];
  });
}

/** What may sit between `)` and `{` of a definition: throws lists, const, noexcept, -> type, mutable… */
const BETWEEN = /^[\s\w$:<>,&*.\->]*(noexcept\s*(\([^)]*\))?[\s\w$:<>,&*.\->]*)?$/;

/** Every function / method definition, plus C++ lambdas assigned to a name. */
export function findFunctions(m: string, cpp: boolean): FnDef[] {
  const out: FnDef[] = [];
  const re = /([A-Za-z_$][\w$]*)\s*\(/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m))) {
    const name = x[1];
    if (KEYWORDS.has(name)) continue;
    const before = m.slice(Math.max(0, x.index - 12), x.index);
    if (/(\bnew|\.|->|\breturn)\s*$/.test(before)) continue;
    const po = x.index + x[0].length - 1;
    const pc = matching(m, po);
    if (pc < 0) continue;
    let j = pc + 1;
    // up to the next `{` or `;` (a declaration / call ends at `;`)
    while (j < m.length && m[j] !== "{" && m[j] !== ";" && m[j] !== "}" && m[j] !== "=") j++;
    if (m[j] !== "{") continue;
    const between = m.slice(pc + 1, j);
    if (!BETWEEN.test(between)) continue;
    // `: base(x), member(y)` constructor initialisers: the `{` belongs to the constructor; fine either way.
    const close = matching(m, j);
    if (close < 0) continue;
    const params = paramNames(m.slice(po + 1, pc));
    out.push({
      name,
      params: params.filter((p): p is string => p !== null),
      open: j,
      close,
      lambda: false,
      selfParam: null,
      nameAt: x.index,
      paramList: m.slice(po + 1, pc),
    });
  }
  if (cpp) {
    const lam = /([A-Za-z_]\w*)\s*=\s*\[[^\]]*\]\s*\(/g;
    while ((x = lam.exec(m))) {
      const po = x.index + x[0].length - 1;
      const pc = matching(m, po);
      if (pc < 0) continue;
      let j = pc + 1;
      while (j < m.length && m[j] !== "{" && m[j] !== ";") j++;
      if (m[j] !== "{") continue;
      const close = matching(m, j);
      if (close < 0) continue;
      const params = paramNames(m.slice(po + 1, pc)).filter((p): p is string => p !== null);
      // Generic-lambda recursion: [&](auto&& self, int i) { self(self, i + 1); }
      const first = params[0];
      const body = m.slice(j + 1, close);
      const selfParam = first && /auto/.test(m.slice(po + 1, pc).split(",")[0]) && new RegExp(`\\b${first}\\s*\\(`).test(body) ? first : null;
      out.push({ name: x[1], params: selfParam ? params.slice(1) : params, open: j, close, lambda: true, selfParam, nameAt: x.index, paramList: m.slice(po + 1, pc) });
    }
  }
  return out;
}

/** Whether the body calls `name` (directly, as this.name / this->name, or through its self parameter). */
export function isRecursive(m: string, f: FnDef) {
  const body = m.slice(f.open + 1, f.close);
  const call = new RegExp(`(^|[^\\w$])${f.selfParam ?? f.name}\\s*\\(`);
  return call.test(body);
}

/**
 * `return x;` statements directly in a body: [index after `return`, index of its `;`]. Skips bare
 * `return;` and C++ braced `return {…};` (which can't be wrapped in a call).
 */
export function returnsIn(m: string, open: number, close: number): [number, number][] {
  const out: [number, number][] = [];
  const re = /\breturn\b/g;
  re.lastIndex = open;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m)) && x.index < close) {
    let i = x.index + 6;
    while (i < close && /\s/.test(m[i])) i++;
    if (m[i] === ";" || m[i] === "{") continue;
    let depth = 0;
    let j = i;
    for (; j < close; j++) {
      const ch = m[j];
      if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch)) depth--;
      else if (ch === ";" && depth === 0) break;
      if (depth < 0) break;
    }
    if (m[j] === ";") out.push([i, j]);
  }
  return out;
}

/** Applies insertions (all at original indexes); several at one index keep their order. */
export function applyEdits(src: string, edits: Edit[]) {
  const sorted = edits.map((e, i) => ({ ...e, i })).sort((a, b) => b.at - a.at || b.i - a.i);
  let s = src;
  for (const e of sorted) s = s.slice(0, e.at) + e.text + s.slice(e.at);
  return s;
}
