/**
 * Runs user code and records every call to its recursive functions. Runs inside a Web Worker
 * (recursion.worker.ts), so nothing here touches the DOM, and a runaway loop can be killed.
 */

export const LIMIT = 3000;
export const MAX_DEPTH = 800;

/** A value as it was at one moment, made plain so it can be posted and printed later. */
export type Snap =
  | null
  | number
  | boolean
  | string
  | Snap[]
  | { __u: 1 }
  | { __f: string }
  | { __c: 1 }
  | { __x: 1 }
  | { __set: Snap[] }
  | { __map: [Snap, Snap][] }
  | { __o: Record<string, Snap> };

export type RawNode = {
  id: number;
  name: string;
  isMain: boolean;
  args: Snap[];
  params: string[];
  parent: number;
  children: number[];
  depth: number;
  /** Text from label() before this call: the choice that led here. */
  edge: string | null;
  notes: string[];
  found: boolean;
  /** Index of its call event; its return event is at `exit`. */
  enter: number;
  exit: number;
  hasRet: boolean;
  ret: Snap | null;
  threw: boolean;
  /** Line in the user's code that made this call, when the browser reports it. */
  line: number | null;
};

export type TraceEvent = { type: "call" | "return"; id: number };

export type RunResult = {
  nodes: RawNode[];
  events: TraceEvent[];
  logs: { step: number; text: string }[];
  usedFound: boolean;
  error: string | null;
  traced: string[];
};

class LimitError extends Error {}

function stripComments(code: string) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Names of functions declared with `function name(…) {…}` whose body calls themselves. */
export function detectRecursive(code: string) {
  const src = stripComments(code);
  const out: string[] = [];
  const re = /function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    const open = src.indexOf("{", src.indexOf(")", m.index));
    if (open < 0) continue;
    let depth = 0;
    let end = src.length;
    for (let j = open; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) {
        end = j;
        break;
      }
    }
    const call = new RegExp("(^|[^\\w$.])" + name.replace(/\$/g, "\\$") + "\\s*\\(");
    if (call.test(src.slice(open + 1, end)) && !out.includes(name)) out.push(name);
  }
  return out;
}

function paramNames(fn: (...a: unknown[]) => unknown) {
  const m = Function.prototype.toString.call(fn).match(/^[^(]*\(([^)]*)\)/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.replace(/=[\s\S]*$/, "").replace(/^\s*\.\.\./, "").trim())
    .filter(Boolean);
}

export function snap(v: unknown, d = 0, seen = new WeakSet<object>()): Snap {
  const t = typeof v;
  if (v === null || t === "number" || t === "boolean" || t === "string") return v as Snap;
  if (t === "undefined") return { __u: 1 };
  if (t === "bigint") return `${String(v)}n`;
  if (t === "function") return { __f: (v as { name?: string }).name || "fn" };
  if (t === "symbol") return String(v);
  const o = v as object;
  if (seen.has(o)) return { __c: 1 };
  if (d > 6) return { __x: 1 };
  seen.add(o);
  let r: Snap;
  if (Array.isArray(o) || ArrayBuffer.isView(o)) r = Array.from(o as ArrayLike<unknown>).slice(0, 200).map((x) => snap(x, d + 1, seen));
  else if (o instanceof Set) r = { __set: [...o].slice(0, 200).map((x) => snap(x, d + 1, seen)) };
  else if (o instanceof Map) r = { __map: [...o].slice(0, 200).map(([a, b]) => [snap(a, d + 1, seen), snap(b, d + 1, seen)] as [Snap, Snap]) };
  else {
    const out: Record<string, Snap> = {};
    for (const k of Object.keys(o).slice(0, 100)) out[k] = snap((o as Record<string, unknown>)[k], d + 1, seen);
    r = { __o: out };
  }
  seen.delete(o);
  return r;
}

export function fmt(s: Snap): string {
  if (s === null) return "null";
  if (typeof s === "string") return JSON.stringify(s);
  if (typeof s !== "object") return String(s);
  if (Array.isArray(s)) return "[" + s.map(fmt).join(",") + "]";
  if ("__u" in s) return "undefined";
  if ("__f" in s) return "ƒ " + s.__f;
  if ("__c" in s) return "[circular]";
  if ("__x" in s) return "…";
  if ("__set" in s) return "Set{" + s.__set.map(fmt).join(",") + "}";
  if ("__map" in s) return "Map{" + s.__map.map(([a, b]) => fmt(a) + ":" + fmt(b)).join(",") + "}";
  return "{" + Object.entries(s.__o).map(([a, b]) => a + ":" + fmt(b)).join(",") + "}";
}

const logText = (v: unknown) => (typeof v === "string" ? v : fmt(snap(v)));

/** Line:column of the nearest frame inside the user's code (Chrome, Edge, Firefox). */
function codeLine(): number | null {
  const stack = new Error().stack ?? "";
  for (const frame of stack.split("\n")) {
    const m = /(?:<anonymous>|> Function):(\d+):\d+\)?\s*$/.exec(frame);
    if (m) return Number(m[1]);
  }
  return null;
}

export function execute(code: string): RunResult {
  const traceDir = (code.match(/\/\/\s*@trace\s+([^\n]+)/) || [])[1];
  const traced = traceDir ? traceDir.split(/[\s,]+/).filter(Boolean) : detectRecursive(code);
  const nodes: RawNode[] = [];
  const events: TraceEvent[] = [];
  const logs: RunResult["logs"] = [];
  let usedFound = false;
  let error: string | null = null;
  const root: RawNode = {
    id: 0, name: "main", isMain: true, args: [], params: [], parent: -1, children: [], depth: 0,
    edge: null, notes: [], found: false, enter: -1, exit: Infinity, hasRet: false, ret: null, threw: false, line: null,
  };
  nodes.push(root);
  const stack = [root];
  let pending: string | null = null;
  let calls = 0;
  let lineBase: number | null = null;
  const cur = () => stack[stack.length - 1];
  const userLine = () => {
    const l = codeLine();
    return l !== null && lineBase !== null ? l - lineBase : null;
  };

  const wrap = (fn: unknown, name: string) => {
    if (typeof fn !== "function") return fn;
    const f = fn as (...a: unknown[]) => unknown;
    const params = paramNames(f);
    return function (this: unknown, ...args: unknown[]) {
      if (calls >= LIMIT) throw new LimitError(`Stopped after ${LIMIT} calls. Try a smaller input.`);
      if (stack.length > MAX_DEPTH) throw new LimitError(`Stopped at ${MAX_DEPTH} levels deep. Check that your base case is reached.`);
      calls++;
      const parent = cur();
      const node: RawNode = {
        id: nodes.length, name, isMain: false, args: args.map((a) => snap(a)), params, parent: parent.id, children: [],
        depth: parent.depth + 1, edge: pending, notes: [], found: false, enter: events.length, exit: -1,
        hasRet: false, ret: null, threw: false, line: userLine(),
      };
      pending = null;
      nodes.push(node);
      parent.children.push(node.id);
      events.push({ type: "call", id: node.id });
      stack.push(node);
      try {
        const r = f.apply(this, args);
        if (r !== undefined) {
          node.hasRet = true;
          node.ret = snap(r);
        }
        return r;
      } catch (e) {
        node.threw = true;
        throw e;
      } finally {
        stack.pop();
        node.exit = events.length;
        events.push({ type: "return", id: node.id });
      }
    };
  };

  const helpers = {
    found: (...a: unknown[]) => {
      const n = cur();
      n.found = true;
      usedFound = true;
      if (a.length) n.notes.push(a.map(logText).join(" "));
    },
    note: (...a: unknown[]) => void cur().notes.push(a.map(logText).join(" ")),
    label: (t: unknown) => void (pending = String(t)),
    log: (...a: unknown[]) => void logs.push({ step: events.length, text: a.map(logText).join(" ") }),
  };
  const con = { log: helpers.log, info: helpers.log, warn: helpers.log, error: helpers.log, table: helpers.log, debug: helpers.log };
  const mark = () => void (lineBase = codeLine());
  const prelude = traced.map((n) => `try{${n}=__wrap(${n},${JSON.stringify(n)});}catch(__e){}`).join("");
  // __mark sits on the line just above the user's first line, so frame lines map back to code lines.
  const body = `"use strict";\n{\n${prelude}\n__mark();\n${code}\n}`;
  try {
    const f = new Function("__wrap", "__mark", "found", "note", "label", "log", "console", body);
    f(wrap, mark, helpers.found, helpers.note, helpers.label, helpers.log, con);
  } catch (e) {
    error = e instanceof LimitError ? e.message : `${(e as Error)?.name || "Error"}: ${(e as Error)?.message ?? String(e)}`;
  }
  for (const n of nodes) if (n.exit === -1) n.exit = events.length;
  root.exit = events.length;
  return { nodes, events, logs, usedFound, error, traced };
}
