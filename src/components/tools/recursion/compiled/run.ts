import type { RunResult } from "../engine";
import type { ServerLanguage } from "../runTypes";
import { CPP_RUNTIME, instrumentCpp } from "./cpp";
import { instrumentJava } from "./java";
import { parseRun, type RunnerOutput } from "./protocol";

/**
 * Runs Java / C++ for the visualizer on Compiler Explorer's public API (CODE_RUNNER=godbolt):
 * instruments the code, runs it, and turns its output into a RunResult. No server or sign-up, but
 * the code is sent to godbolt.org and it's a free, fair-use service.
 * If the instrumented code doesn't compile but the user's own code does, the instrumenter met syntax
 * it doesn't understand: the program still runs, untraced, and says so.
 */

export const runnerConfigured = () => process.env.CODE_RUNNER === "godbolt";

type Program = { language: ServerLanguage; source: string; traced: string[] };

const NONE = ["\u0000"]; // trace nothing: the program with only the helpers added

function program(language: ServerLanguage, code: string, plain: boolean): Program {
  if (language === "java") {
    const j = instrumentJava(code, plain ? NONE : undefined);
    return { language, source: j.source, traced: j.traced };
  }
  const c = plain ? { source: code, traced: [] } : instrumentCpp(code);
  return { language, source: c.source, traced: c.traced };
}

type GodboltLines = { text: string }[] | undefined;
const joinLines = (l: GodboltLines) => (l ?? []).map((x) => x.text + "\n").join("");

async function runOnGodbolt(p: Program): Promise<RunnerOutput> {
  const post = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(40_000) }).catch((e: unknown) => {
      throw new Error(`Compiler Explorer can't be reached (${e instanceof Error ? e.message : "network error"}). Try again in a minute.`);
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data) throw new Error(`Compiler Explorer failed (${res.status}). Try again in a minute.`);
    return data;
  };
  const cpp = p.language === "cpp";
  const compiler = cpp ? process.env.GODBOLT_CPP || "g142" : process.env.GODBOLT_JAVA || "java2102";
  // C++: the runtime goes first, then #line 1 so the user's code keeps its own line numbers.
  const source = cpp ? `${CPP_RUNTIME}\n#line 1\n${p.source}` : p.source;
  const d = await post(
    `https://godbolt.org/api/compiler/${compiler}/compile`,
    {
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "CrackQuick recursion visualizer" },
      body: JSON.stringify({
        source,
        options: {
          userArguments: cpp ? "-std=gnu++20 -O1 -w -fdiagnostics-color=never" : "",
          executeParameters: { args: [], stdin: "" },
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
        },
      }),
    },
  );
  const build = d.buildResult as { code?: number; stderr?: GodboltLines; stdout?: GodboltLines } | undefined;
  if (build && build.code !== 0) {
    return { exitCode: 101, stdout: "", stderr: joinLines(build.stderr) + joinLines(build.stdout), timedOut: Boolean(d.timedOut), truncated: false };
  }
  return {
    exitCode: typeof d.code === "number" ? d.code : -1,
    stdout: joinLines(d.stdout as GodboltLines),
    stderr: joinLines(d.stderr as GodboltLines),
    timedOut: Boolean(d.timedOut),
    truncated: Boolean(d.truncated),
  };
}

/** Compiler / runtime messages with plain line numbers and without the tracer's own stack frames. */
function describe(language: ServerLanguage, out: RunnerOutput) {
  let text = out.stderr
    .replace(/\u001b\[[0-9;]*[mK]/g, "") // terminal colours
    .replace(/<source>:(\d+):(\d+:)?/g, "line $1:")
    .replace(/<source>: /g, "")
    .split("\n")
    .filter((l) => !/__T\.|__rtv|rtv\.hpp|^In file included from/.test(l))
    .slice(0, 25)
    .join("\n")
    .trim();
  if (out.exitCode === 101) return `Compile error:\n${text}`;
  if (out.exitCode === 139) text = `Segmentation fault: the program read or wrote memory it shouldn't (often an index out of range or a null pointer).\n${text}`;
  else if (out.exitCode === 136) text = `Arithmetic error (for example, division by zero).\n${text}`;
  else if (out.exitCode === 134) text = `The program aborted (an uncaught exception or a failed assert).\n${text}`;
  else if (out.exitCode === 137) text = `The program was stopped: it used too much memory or time.\n${text}`;
  return text || `${language === "java" ? "Java" : "The program"} exited with code ${out.exitCode}.`;
}

export async function runCompiled(language: ServerLanguage, code: string): Promise<RunResult> {
  const lines = code.split("\n").length;
  const fail = (error: string): RunResult => ({ nodes: [], events: [], logs: [], usedFound: false, error, traced: [] });
  if (!runnerConfigured()) return fail("Java and C++ aren't set up on this server yet.");
  const run = runOnGodbolt;

  let traced: Program;
  try {
    traced = program(language, code, false);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read this code.");
  }
  const out = await run(traced);
  if (out.exitCode !== 101) return parseRun(out, traced.traced, lines, () => describe(language, out));

  // Didn't compile: is it the user's code, or our additions?
  const plain = await run(program(language, code, true));
  if (plain.exitCode === 101) return fail(describe(language, plain));
  const result = parseRun(plain, [], lines, () => describe(language, plain));
  return {
    ...result,
    error:
      result.error ??
      "Your code ran, but the visualizer couldn't add tracing to it, so there's no tree. Simplify the recursive function's signature (plain parameters, no templates or macros) and try again.",
  };
}
