import type { RawNode, RunResult, Snap, TraceEvent } from "../engine";

/**
 * Instrumented Java / C++ programs print trace events on stdout, each as MARK + one JSON object +
 * newline, mixed with the program's own output:
 *   {"t":"c","n":name,"l":line,"e":edgeLabel|null,"p":[params],"a":[args]}   a call
 *   {"t":"v","v":value}   the current call's return value      {"t":"x"}   it returned
 *   {"t":"f","x":text}    found()     {"t":"n","x":text}   note()     {"t":"limit","x":why}
 */
export const MARK = "\u0001RTV ";
export const LIMIT = 3000;
export const MAX_DEPTH = 800;

export type RunnerOutput = { exitCode: number; stdout: string; stderr: string; timedOut: boolean; truncated: boolean };

type Ev =
  | { t: "c"; n: string; l: number; e: string | null; p: string[]; a: Snap[] }
  | { t: "v"; v: Snap }
  | { t: "x" }
  | { t: "f"; x: string }
  | { t: "n"; x: string }
  | { t: "limit"; x: string };

/** Turns a run's output into the same RunResult the JavaScript and Python engines produce. */
export function parseRun(out: RunnerOutput, traced: string[], lineCount: number, describeError: (stderr: string) => string): RunResult {
  const root: RawNode = {
    id: 0, name: "main", isMain: true, args: [], params: [], parent: -1, children: [], depth: 0, edge: null,
    notes: [], found: false, enter: -1, exit: -1, hasRet: false, ret: null, threw: false, line: null,
  };
  const nodes: RawNode[] = [root];
  const events: TraceEvent[] = [];
  const logs: RunResult["logs"] = [];
  const stack = [root];
  let usedFound = false;
  let error: string | null = null;
  let text = "";

  const flushText = (all: boolean) => {
    const parts = text.split("\n");
    text = all ? "" : parts.pop()!;
    for (const line of all ? parts.filter((p, i) => i < parts.length - 1 || p) : parts) logs.push({ step: events.length, text: line });
  };

  let i = 0;
  const s = out.stdout;
  while (i < s.length) {
    const at = s.indexOf(MARK, i);
    if (at < 0) {
      text += s.slice(i);
      break;
    }
    text += s.slice(i, at);
    flushText(false);
    const end = s.indexOf("\n", at);
    const json = s.slice(at + MARK.length, end < 0 ? s.length : end);
    i = end < 0 ? s.length : end + 1;
    let ev: Ev;
    try {
      ev = JSON.parse(json) as Ev;
    } catch {
      continue; // cut off by the output limit
    }
    const top = stack[stack.length - 1];
    if (ev.t === "c") {
      const node: RawNode = {
        id: nodes.length, name: ev.n, isMain: false, args: ev.a, params: ev.p, parent: top.id, children: [],
        depth: top.depth + 1, edge: ev.e, notes: [], found: false, enter: events.length, exit: -1,
        hasRet: false, ret: null, threw: false, line: ev.l > 0 && ev.l <= lineCount ? ev.l : null,
      };
      nodes.push(node);
      top.children.push(node.id);
      events.push({ type: "call", id: node.id });
      stack.push(node);
    } else if (ev.t === "v") {
      if (!top.isMain) {
        top.hasRet = true;
        top.ret = ev.v;
      }
    } else if (ev.t === "x") {
      if (stack.length > 1) {
        stack.pop();
        top.exit = events.length;
        events.push({ type: "return", id: top.id });
      }
    } else if (ev.t === "f") {
      top.found = true;
      usedFound = true;
      if (ev.x) top.notes.push(ev.x);
    } else if (ev.t === "n") top.notes.push(ev.x);
    else if (ev.t === "limit") error = ev.x;
  }
  flushText(true);

  if (!error) {
    if (out.timedOut) error = "Your program ran too long and was stopped. Is there a loop that never ends, or a base case that's never reached?";
    else if (out.exitCode !== 0) error = describeError(out.stderr) || `The program exited with code ${out.exitCode}.`;
    else if (out.truncated) error = "The program printed too much; the output was cut off.";
  }
  for (const n of stack.slice(1)) n.threw = Boolean(error);
  for (const n of nodes) if (n.exit === -1) n.exit = events.length;
  root.exit = events.length;
  return { nodes, events, logs, usedFound, error, traced };
}
