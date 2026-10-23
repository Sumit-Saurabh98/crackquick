import { fmt, type RawNode, type RunResult } from "./engine";
import type { Language } from "./runTypes";

export type Status = "main" | "ok" | "dead" | "path" | "plain";

export type TNode = RawNode & {
  status: Status;
  /** Earlier call with the same function and arguments (repeated work), or -1. */
  repeatOf: number;
  /** How many times this exact call happens in the run (on the first one). */
  repeats: number;
  /** 1-based answer number for found() calls. */
  answerNo: number;
};

export type Trace = Omit<RunResult, "nodes"> & {
  nodes: TNode[];
  code: string;
  language: Language;
  stats: { calls: number; answers: number; dead: number; maxDepth: number; repeated: number };
  paramOrder: string[];
  defaultVisible: Set<string>;
  /** More than one traced function name (show the name in every box). */
  multi: boolean;
};

const MAIN: RawNode = {
  id: 0, name: "main", isMain: true, args: [], params: [], parent: -1, children: [], depth: 0, edge: null,
  notes: [], found: false, enter: -1, exit: 0, hasRet: false, ret: null, threw: false, line: null,
};

export function analyse(run: RunResult, code: string, language: Language): Trace {
  // A run that never started (timeout, Python failed to load) still gets its main box.
  const raw = run.nodes.length ? run.nodes : [MAIN];
  const nodes = raw.map((n) => ({ ...n, status: "plain" as Status, repeatOf: -1, repeats: 0, answerNo: 0 }));
  const leads = new Array<boolean>(nodes.length).fill(false);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    leads[i] = n.found || n.children.some((c) => leads[c]);
  }
  let answers = 0, dead = 0, maxDepth = 0, repeated = 0;
  const firstSeen = new Map<string, number>();
  for (const n of nodes) {
    if (n.isMain) {
      n.status = "main";
      continue;
    }
    if (n.found) {
      n.status = "ok";
      n.answerNo = ++answers;
    } else if (!n.children.length && run.usedFound) {
      n.status = "dead";
      dead++;
    } else if (leads[n.id]) n.status = "path";
    maxDepth = Math.max(maxDepth, n.depth);
    const key = n.name + JSON.stringify(n.args);
    const first = firstSeen.get(key);
    if (first === undefined) {
      firstSeen.set(key, n.id);
      n.repeats = 1;
    } else {
      n.repeatOf = first;
      nodes[first].repeats++;
      repeated++;
    }
  }

  const order: string[] = [];
  const vals = new Map<string, Set<string>>();
  for (const n of nodes) {
    if (n.isMain) continue;
    n.params.forEach((p, i) => {
      if (!vals.has(p)) {
        vals.set(p, new Set());
        order.push(p);
      }
      const set = vals.get(p)!;
      if (set.size < 3) set.add(JSON.stringify(n.args[i]));
    });
  }
  const show = (code.match(/(?:\/\/|#)\s*@show\s+([^\n]+)/) || [])[1];
  let defaultVisible: Set<string>;
  if (show) defaultVisible = new Set(show.split(/[\s,]+/).filter((p) => vals.has(p)));
  else {
    defaultVisible = new Set(order.filter((p) => vals.get(p)!.size > 1));
    if (!defaultVisible.size) order.forEach((p) => defaultVisible.add(p));
  }

  return {
    ...run,
    nodes,
    code,
    language,
    stats: { calls: nodes.length - 1, answers, dead, maxDepth, repeated },
    paramOrder: order,
    defaultVisible,
    multi: new Set(nodes.filter((n) => !n.isMain).map((n) => n.name)).size > 1,
  };
}

export function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** `solve(start=0, path=[2])` with the visible parameters. */
export function sig(n: TNode, visible: Set<string>, max = 60) {
  if (n.isMain) return "main";
  const parts = n.params.map((p, i) => (visible.has(p) ? `${p}=${trunc(fmt(n.args[i]), 24)}` : null)).filter(Boolean);
  return trunc(`${n.name}(${parts.join(", ")})`, max);
}

/** The node the step is about: the call just made or the call just finished. */
export function currentNode(t: Trace, k: number) {
  return k > 0 ? t.nodes[t.events[k - 1].id] : t.nodes[0];
}

/** The calls waiting on the stack at step k, outermost first (main included). */
export function stackAt(t: Trace, k: number): TNode[] {
  if (k >= t.events.length) return [];
  const chain: TNode[] = [];
  for (let n: TNode | undefined = currentNode(t, k); n; n = n.parent >= 0 ? t.nodes[n.parent] : undefined) chain.unshift(n);
  return chain;
}

/** The choices (edge labels) from the top down to `n`. */
export function choicesTo(t: Trace, n: TNode) {
  const out: string[] = [];
  for (let x: TNode = n; x.parent >= 0; x = t.nodes[x.parent]) if (x.edge != null) out.unshift(x.edge);
  return out;
}

/* ---------- layout ---------- */

export const CW = 7.5, LH = 16, PADX = 12, PADY = 9, GAPX = 20, GAPY = 70;

export type Box = { lines: string[]; w: number; h: number; x: number; y: number; cx: number };

function nodeLines(t: Trace, n: TNode, visible: Set<string>, showRet: boolean) {
  if (n.isMain) return ["main"];
  const lines: string[] = [];
  if (t.multi) lines.push(`${n.name}()`);
  n.params.forEach((p, i) => visible.has(p) && lines.push(`${p} = ${trunc(fmt(n.args[i]), 30)}`));
  if (!lines.length) lines.push(`${n.name}()`);
  if (showRet && n.hasRet) lines.push(`↩ ${trunc(fmt(n.ret), 30)}`);
  return lines;
}

/** A tidy tree: each subtree gets the width it needs, parents centred over their children. */
export function layoutTree(t: Trace, visible: Set<string>, showRet: boolean) {
  const boxes: Box[] = [];
  const depthH: number[] = [];
  for (const n of t.nodes) {
    const lines = nodeLines(t, n, visible, showRet);
    const w = Math.max(48, Math.max(...lines.map((l) => l.length)) * CW + PADX * 2);
    const h = lines.length * LH + PADY * 2;
    boxes[n.id] = { lines, w, h, x: 0, y: 0, cx: 0 };
    depthH[n.depth] = Math.max(depthH[n.depth] || 0, h);
  }
  const yTop: number[] = [];
  let acc = 0;
  for (let d = 0; d < depthH.length; d++) {
    yTop[d] = acc;
    acc += (depthH[d] || 0) + GAPY;
  }
  const sw: number[] = [], kidsW: number[] = [], left: number[] = [];
  for (let i = t.nodes.length - 1; i >= 0; i--) {
    const n = t.nodes[i];
    kidsW[i] = n.children.reduce((s, c) => s + sw[c], 0) + Math.max(0, n.children.length - 1) * GAPX;
    sw[i] = Math.max(boxes[i].w, kidsW[i]);
  }
  left[0] = 0;
  for (const n of t.nodes) {
    const b = boxes[n.id];
    b.cx = left[n.id] + sw[n.id] / 2;
    b.x = b.cx - b.w / 2;
    b.y = yTop[n.depth];
    let x = b.cx - kidsW[n.id] / 2;
    for (const c of n.children) {
      left[c] = x;
      x += sw[c] + GAPX;
    }
  }
  return { boxes, width: sw[0] ?? 0, height: Math.max(0, acc - GAPY) };
}

/* ---------- narration ---------- */

export type StepKind = "start" | "call" | "leaf" | "found" | "dead" | "return" | "backtrack" | "end";

export type Narration = { kind: StepKind; title: string; text: string; note?: string };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** What step k means, in plain words. */
export function narrate(t: Trace, k: number, visible: Set<string>): Narration {
  const E = t.events.length;
  if (k === 0 && t.error && !E) {
    return { kind: "dead", title: "The code didn't run", text: "See the Output tab below for what went wrong, fix the code, then press Run." };
  }
  if (k === 0 && !t.traced.length) {
    return { kind: "start", title: "No recursion found", text: "Write a function that calls itself (see the Output tab), then press Run." };
  }
  if (k === 0) {
    return {
      kind: "start",
      title: "Ready",
      text: `Your code made ${plural(t.stats.calls, "call")} in total. Press Play (or →) to watch them happen one at a time.`,
    };
  }
  const ev = t.events[k - 1];
  const n = t.nodes[ev.id];
  const parent = t.nodes[n.parent];
  const me = sig(n, visible);
  const up = sig(parent, visible);
  const note = n.notes.length ? n.notes.join(" · ") : undefined;
  const tail = k === E ? " That was the last step: the whole run is done." : "";

  if (ev.type === "call") {
    const waiting = n.depth;
    const choice = n.edge != null ? ` by choosing “${n.edge}”` : "";
    if (!n.children.length) {
      return {
        kind: "leaf",
        title: "Go deeper ↓ (and this one stops here)",
        text: `${up} calls ${me}${choice}. This call doesn't call itself again: it's a base case or a cut-off branch.`,
        note,
      };
    }
    return {
      kind: "call",
      title: "Go deeper ↓",
      text: `${up} calls ${me}${choice}. ${up} now pauses and waits. ${plural(waiting, "call")} ${waiting === 1 ? "is" : "are"} on the stack.`,
      note,
    };
  }

  if (n.status === "ok") {
    return {
      kind: "found",
      title: `Answer #${n.answerNo} found ✔`,
      text: `${me} reached the goal and recorded an answer. Now we backtrack ↶ to ${up} to look for more answers.${tail}`,
      note,
    };
  }
  if (n.status === "dead") {
    return {
      kind: "dead",
      title: "Dead end ✕, backtrack ↶",
      text: `${me} can't lead to an answer, so we give up on it and go back to ${up}${n.edge != null ? `, which undoes the choice “${n.edge}” and tries its next option` : ""}.${tail}`,
      note,
    };
  }
  if (n.hasRet) {
    return {
      kind: "return",
      title: "Return ↩",
      text: `${me} is finished and hands the value ${trunc(fmt(n.ret), 40)} back up to ${up}, which continues from where it paused.${tail}`,
      note,
    };
  }
  return {
    kind: "backtrack",
    title: "Backtrack ↶",
    text: `${me} has tried everything below it. Control goes back up to ${up}${n.edge != null ? `, the choice “${n.edge}” is undone,` : ""} and it carries on with its next option.${tail}`,
    note,
  };
}
