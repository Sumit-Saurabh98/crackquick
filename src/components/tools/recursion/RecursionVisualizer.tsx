"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fmt, type RunResult } from "./engine";
import { analyse, choicesTo, currentNode, layoutTree, narrate, sig, stackAt, trunc, type Narration, type TNode, type Trace } from "./analysis";
import { CodePane } from "./CodePane";
import { PRESETS } from "./presets";
import { TreeCanvas, type CanvasApi, type ViewOptions } from "./TreeCanvas";
import s from "./visualizer.module.css";

const RUN_TIMEOUT_MS = 4000;
const SPEEDS = [
  { ms: 1400, label: "Very slow" },
  { ms: 800, label: "Slow" },
  { ms: 420, label: "Normal" },
  { ms: 160, label: "Fast" },
  { ms: 45, label: "Very fast" },
];
const KEY = { code: "rtv:code", preset: "rtv:preset", guided: "rtv:guided", options: "rtv:options" };

function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: nothing to keep
  }
}

/** Runs the code in a throwaway worker, so an endless loop is stopped instead of freezing the page. */
function runInWorker(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./recursion.worker.ts", import.meta.url));
    const main = {
      id: 0, name: "main", isMain: true, args: [], params: [], parent: -1, children: [], depth: 0, edge: null,
      notes: [], found: false, enter: -1, exit: 0, hasRet: false, ret: null, threw: false, line: null,
    };
    const fail = (error: string) => resolve({ nodes: [main], events: [], logs: [], usedFound: false, error, traced: [] });
    const timer = setTimeout(() => {
      worker.terminate();
      fail(`Your code ran for more than ${RUN_TIMEOUT_MS / 1000} seconds and was stopped. Is there a loop that never ends, or a base case that's never reached?`);
    }, RUN_TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<RunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      fail(e.message || "The code could not run.");
    };
    worker.postMessage({ code });
  });
}

const DEFAULT_OPTIONS: ViewOptions = { follow: true, dim: false, trails: false, repeats: true, motion: true };

const KIND_STYLE: Record<Narration["kind"], { tone: string; icon: string }> = {
  start: { tone: "border-line bg-bg2 text-ink", icon: "▶" },
  call: { tone: "border-brass/50 bg-brass/10 text-brass2", icon: "↓" },
  leaf: { tone: "border-brass/50 bg-brass/10 text-brass2", icon: "↓" },
  found: { tone: "border-good/50 bg-good/10 text-good", icon: "✔" },
  dead: { tone: "border-rose-400/50 bg-rose-400/10 text-rose-300", icon: "✕" },
  return: { tone: "border-sky-400/50 bg-sky-400/10 text-sky-300", icon: "↩" },
  backtrack: { tone: "border-sky-400/50 bg-sky-400/10 text-sky-300", icon: "↶" },
  end: { tone: "border-good/40 bg-good/10 text-good", icon: "■" },
};

type Tab = "vars" | "answers" | "output" | "selected";

export function RecursionVisualizer() {
  const [code, setCode] = useState(PRESETS.find((p) => p.id === "subsets")!.code);
  const [preset, setPreset] = useState("subsets");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [running, setRunning] = useState(false);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(420);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("vars");
  const [options, setOptions] = useState<ViewOptions>(DEFAULT_OPTIONS);
  const [guide, setGuide] = useState(false);
  const [legend, setLegend] = useState(true);
  const [top, setTop] = useState(57);
  const canvas = useRef<CanvasApi>(null);

  // Fill the screen under the app's header.
  useLayoutEffect(() => {
    const header = document.querySelector("header");
    const measure = () => setTop(Math.round(header?.getBoundingClientRect().bottom ?? 57));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const run = useCallback(async (src: string, presetId: string) => {
    setRunning(true);
    setPlaying(false);
    store(KEY.code, src);
    store(KEY.preset, presetId);
    const result = await runInWorker(src);
    const t = analyse(result, src);
    setTrace(t);
    setVisible(new Set(t.defaultVisible));
    setSelected(null);
    setK(0);
    setTab(result.error || !result.traced.length ? "output" : "vars");
    setRunning(false);
    // Start playing straight away so the first thing people see is the tree growing.
    if (!result.error && result.events.length) setPlaying(true);
  }, []);

  // First load: last code (or the default example), saved view options, and the guide once.
  useEffect(() => {
    const saved = load(KEY.code);
    const savedPreset = load(KEY.preset) ?? "custom";
    const src = saved ?? PRESETS.find((p) => p.id === "subsets")!.code;
    /* eslint-disable react-hooks/set-state-in-effect -- restoring saved state once on mount */
    try {
      const o = JSON.parse(load(KEY.options) ?? "null");
      if (o && typeof o === "object") setOptions({ ...DEFAULT_OPTIONS, ...o });
    } catch {
      // ignore a bad saved value
    }
    if (saved) {
      setCode(saved);
      setPreset(PRESETS.some((p) => p.id === savedPreset) ? savedPreset : "custom");
    }
    if (!load(KEY.guided)) setGuide(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    void run(src, saved ? savedPreset : "subsets");
  }, [run]);

  const E = trace?.events.length ?? 0;

  // Playback.
  useEffect(() => {
    if (!playing || !trace) return;
    const t = setInterval(() => {
      setK((x) => {
        if (x >= trace.events.length) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [playing, speed, trace]);

  const go = useCallback(
    (to: number) => {
      setPlaying(false);
      setK(Math.max(0, Math.min(E, to)));
    },
    [E],
  );

  const togglePlay = useCallback(() => {
    if (!trace || !E) return;
    if (playing) return setPlaying(false);
    if (k >= E) setK(0);
    setPlaying(true);
  }, [trace, E, playing, k]);

  const cur = trace ? currentNode(trace, k) : null;

  const stepOut = useCallback(() => {
    if (!trace || !cur || cur.isMain) return;
    go(cur.exit + 1);
  }, [trace, cur, go]);

  const nextAnswer = useCallback(() => {
    if (!trace) return;
    const at = trace.events.findIndex((ev, i) => i >= k && ev.type === "return" && trace.nodes[ev.id].status === "ok");
    if (at >= 0) go(at + 1);
  }, [trace, k, go]);

  // Keyboard: ← → step, space plays, Home / End.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight") go(k + 1);
      else if (e.key === "ArrowLeft") go(k - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(E);
      else if (e.key === " " && tag !== "BUTTON") togglePlay();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, k, E, togglePlay]);

  const setOption = (key: keyof ViewOptions) =>
    setOptions((o) => {
      const next = { ...o, [key]: !o[key] };
      store(KEY.options, JSON.stringify(next));
      return next;
    });

  const layout = useMemo(() => (trace ? layoutTree(trace, visible, true) : null), [trace, visible]);
  const stale = trace !== null && trace.code !== code;
  const narration: Narration | null = trace
    ? k === E && E > 0
      ? {
          kind: "end",
          title: "Finished",
          text: `The whole run: ${trace.stats.calls} calls, ${trace.stats.maxDepth} levels deep${
            trace.usedFound ? `, ${trace.stats.answers} answers and ${trace.stats.dead} dead ends` : ""
          }. Press ⏮ or Play to watch it again, or click any box.`,
        }
      : narrate(trace, k, visible)
    : null;

  const ev = trace && k > 0 && k <= E ? trace.events[k - 1] : null;
  const codeLine = !stale && ev && trace ? trace.nodes[ev.id].line : null;

  function pickPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setCode(p.code);
    void run(p.code, id);
  }

  function closeGuide() {
    setGuide(false);
    store(KEY.guided, "1");
  }

  const groups = [...new Set(PRESETS.map((p) => p.group))];

  return (
    <div className={`${s.root} -mx-4 -mt-6 -mb-20 flex flex-col bg-bg sm:-mx-6 lg:fixed lg:inset-x-0 lg:bottom-0 lg:z-10 lg:m-0`} style={{ top }}>
      {/* title bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
        <Link href="/tools" className="text-sm text-muted hover:text-ink">
          ← Tools
        </Link>
        <div className="min-w-0">
          <h1 className="display text-lg leading-tight text-brass2">Recursion & Backtracking Visualizer</h1>
          <p className="hidden text-xs text-muted sm:block">Write a recursive function, run it, and watch every call go down and every backtrack come back up.</p>
        </div>
        <button onClick={() => setGuide(true)} className="btn btn-sm ml-auto">
          ? How to read this
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,400px)_1fr]">
        {/* left: code */}
        <section aria-label="Code" className="flex min-h-105 flex-col border-b border-line lg:min-h-0 lg:border-r lg:border-b-0">
          <div className="flex items-center gap-2 border-b border-line p-2.5">
            <select value={preset} onChange={(e) => pickPreset(e.target.value)} aria-label="Example" className="field min-w-0 flex-1 py-1.5 text-sm">
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {PRESETS.filter((p) => p.group === g).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">My code</option>
            </select>
            <button onClick={() => run(code, preset)} disabled={running} className="btn-primary flex items-center gap-1.5" title="Run (Ctrl/⌘ + Enter)">
              {running ? <span className="spinner spinner-sm" /> : "▶"} Run
            </button>
          </div>
          {stale ? (
            <button onClick={() => run(code, preset)} className="border-b border-brass/30 bg-brass/10 px-3 py-1.5 text-left text-xs text-brass2">
              Code changed. Press Run (⌘/Ctrl + Enter) to see the new tree.
            </button>
          ) : null}
          <CodePane
            value={code}
            onChange={(v) => {
              setCode(v);
              if (preset !== "custom") setPreset("custom");
            }}
            onRun={() => run(code, preset)}
            line={codeLine}
            tone={ev?.type === "return" ? "back" : "call"}
          />
          <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">
            {codeLine !== null ? (
              ev?.type === "return" ? (
                <>
                  <span className="text-sky-300">Blue line</span>: control comes back to this call and carries on after it.
                </>
              ) : (
                <>
                  <span className="text-brass">Gold line</span>: the call happening right now was made here.
                </>
              )
            ) : (
              "Your code is saved in this browser. Helpers: found(), label(), note(), log()."
            )}
          </p>
        </section>

        {/* right: tree + controls + panels */}
        <section aria-label="Recursion tree" className="grid min-h-0 grid-rows-[auto_minmax(380px,1fr)_auto_auto] lg:grid-rows-[auto_1fr_auto_200px]">
          <ParamBar trace={trace} visible={visible} setVisible={setVisible} />

          <div className="relative min-h-0">
            {trace && layout ? (
              <TreeCanvas ref={canvas} trace={trace} layout={layout} k={k} visible={visible} selected={selected} options={options} onSelect={(id) => (setSelected(id), setTab("selected"))} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">{running ? "Running…" : "Run some code to see its tree."}</div>
            )}
            {trace ? <Stats trace={trace} /> : null}
            <div className="absolute top-2.5 right-3 flex flex-col items-end gap-1.5">
              <div className="flex gap-1">
                <button className="btn btn-sm bg-bg2" onClick={() => canvas.current?.zoom(1.25)} aria-label="Zoom in">
                  +
                </button>
                <button className="btn btn-sm bg-bg2" onClick={() => canvas.current?.zoom(0.8)} aria-label="Zoom out">
                  −
                </button>
                <button className="btn btn-sm bg-bg2" onClick={() => canvas.current?.fit()}>
                  Fit
                </button>
              </div>
              <div className="flex max-w-88 flex-wrap justify-end gap-1">
                {(
                  [
                    ["follow", "Follow call", "Move the view to the current call"],
                    ["dim", "Focus path", "Fade everything that isn't on the call stack"],
                    ["trails", "Return trail", "Keep a faint arrow for every return so far"],
                    ["repeats", "Repeats", "Mark calls with the same arguments (work a memo could skip)"],
                    ["motion", "Animations", "Turn animations on or off"],
                  ] as const
                ).map(([key, label, title]) => (
                  <button key={key} className="chip bg-bg2" aria-pressed={options[key]} onClick={() => setOption(key)} title={title}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Legend open={legend} onToggle={() => setLegend((o) => !o)} />
          </div>

          <Controls
            trace={trace}
            k={k}
            go={go}
            playing={playing}
            togglePlay={togglePlay}
            speed={speed}
            setSpeed={setSpeed}
            stepOut={stepOut}
            nextAnswer={nextAnswer}
            canStepOut={Boolean(cur && !cur.isMain && k < E)}
            narration={narration}
          />

          <div className="grid min-h-0 grid-cols-1 border-t border-line bg-bg2/40 md:grid-cols-[minmax(240px,1fr)_1.4fr]">
            <StackPanel trace={trace} k={k} visible={visible} onPick={(id) => (setSelected(id), setTab("selected"), canvas.current?.center(id))} />
            <InfoTabs trace={trace} k={k} tab={tab} setTab={setTab} visible={visible} selected={selected} go={go} cur={cur} />
          </div>
        </section>
      </div>

      {guide ? <Guide onClose={closeGuide} /> : null}
    </div>
  );
}

/* ---------- pieces ---------- */

function ParamBar({ trace, visible, setVisible }: { trace: Trace | null; visible: Set<string>; setVisible: (v: Set<string>) => void }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 border-b border-line px-3 py-2 text-xs">
      <span className="text-muted">Show in boxes:</span>
      {!trace?.paramOrder.length ? <span className="text-muted/70">no parameters yet</span> : null}
      {trace?.paramOrder.map((p) => (
        <button
          key={p}
          className="chip font-mono"
          aria-pressed={visible.has(p)}
          onClick={() => {
            const next = new Set(visible);
            if (next.has(p)) next.delete(p);
            else next.add(p);
            setVisible(next);
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function Stats({ trace }: { trace: Trace }) {
  const st = trace.stats;
  return (
    <div className="pointer-events-none absolute top-2.5 left-3 flex flex-wrap gap-1.5 text-xs">
      <span className="rounded-lg border border-line bg-bg2/90 px-2.5 py-1">
        <b className="text-ink">{st.calls}</b> <span className="text-muted">calls</span>
      </span>
      <span className="rounded-lg border border-line bg-bg2/90 px-2.5 py-1">
        <b className="text-ink">{st.maxDepth}</b> <span className="text-muted">deep</span>
      </span>
      {trace.usedFound ? (
        <>
          <span className="rounded-lg border border-good/40 bg-bg2/90 px-2.5 py-1 text-good">
            <b>{st.answers}</b> answers
          </span>
          <span className="rounded-lg border border-rose-400/40 bg-bg2/90 px-2.5 py-1 text-rose-300">
            <b>{st.dead}</b> dead ends
          </span>
        </>
      ) : null}
      {st.repeated ? (
        <span className="rounded-lg border border-violet-400/40 bg-bg2/90 px-2.5 py-1 text-violet-300" title="Calls with arguments already seen earlier: a memo would skip these">
          <b>{st.repeated}</b> repeated
        </span>
      ) : null}
    </div>
  );
}

function Legend({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const items: [string, string, string][] = [
    ["Current call", "border-brass bg-[#3a2f17]", "The call running right now"],
    ["On the stack", "border-brass bg-[#151d2b]", "Paused, waiting for a deeper call to finish"],
    ["Answer", "border-good bg-[#11352a]", "found() was called here"],
    ["Leads to answer", "border-good bg-[#151d2b]", "An answer is somewhere below"],
    ["Dead end", "border-rose-400 border-dashed bg-[#3b1823]", "Finished without finding anything"],
    ["Repeated", "border-violet-400 border-dotted bg-[#272043]", "Same arguments as an earlier call"],
  ];
  return (
    <div className="absolute right-3 bottom-2.5 left-3 flex justify-start text-[11px]">
      {open ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-bg2/90 px-3 py-1.5 shadow-lg backdrop-blur">
          {items.map(([label, cls, title]) => (
            <span key={label} className="flex items-center gap-1.5" title={title}>
              <i className={`inline-block h-3 w-4 rounded border-2 ${cls}`} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-0.5 w-4 bg-brass" /> Call ↓
          </span>
          <span className="flex items-center gap-1.5 text-sky-300">
            <i className="inline-block h-0.5 w-4 bg-sky-400 shadow-[0_0_6px_#5fb4ff]" /> Backtrack / return ↑
          </span>
          <button onClick={onToggle} className="text-muted hover:text-ink" aria-label="Hide legend" title="Hide legend">
            ✕
          </button>
        </div>
      ) : (
        <button onClick={onToggle} className="chip bg-bg2">
          Legend
        </button>
      )}
    </div>
  );
}

function Timeline({ trace, k, go }: { trace: Trace | null; k: number; go: (k: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const E = trace?.events.length ?? 0;
  useEffect(() => {
    const c = ref.current;
    if (!c || !trace) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = c.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      const g = c.getContext("2d");
      if (!g) return;
      g.scale(dpr, dpr);
      g.clearRect(0, 0, W, H);
      const n = trace.events.length;
      if (!n) return;
      trace.events.forEach((ev, i) => {
        if (ev.type !== "return") return;
        const st = trace.nodes[ev.id].status;
        if (st !== "ok" && st !== "dead") return;
        const x = 8 + ((i + 1) / n) * (W - 16);
        g.fillStyle = st === "ok" ? "#3dba8b" : "rgba(240,96,122,.55)";
        const h = st === "ok" ? H : H * 0.55;
        g.fillRect(x - (st === "ok" ? 1.5 : 0.75), (H - h) / 2, st === "ok" ? 3 : 1.5, h);
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [trace]);
  return (
    <div className={s.timeline}>
      <canvas ref={ref} aria-hidden />
      <input type="range" min={0} max={E} value={k} onChange={(e) => go(Number(e.target.value))} aria-label="Step" className={s.range} />
    </div>
  );
}

function Controls({
  trace,
  k,
  go,
  playing,
  togglePlay,
  speed,
  setSpeed,
  stepOut,
  nextAnswer,
  canStepOut,
  narration,
}: {
  trace: Trace | null;
  k: number;
  go: (k: number) => void;
  playing: boolean;
  togglePlay: () => void;
  speed: number;
  setSpeed: (n: number) => void;
  stepOut: () => void;
  nextAnswer: () => void;
  canStepOut: boolean;
  narration: Narration | null;
}) {
  const E = trace?.events.length ?? 0;
  const style = narration ? KIND_STYLE[narration.kind] : KIND_STYLE.start;
  const icon = "grid size-9 place-items-center rounded-full border border-line text-ink hover:border-brass/60 disabled:opacity-40";
  return (
    <div className="grid gap-2 border-t border-line px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className={icon} onClick={() => go(0)} disabled={!E || k === 0} aria-label="First step" title="First step (Home)">
            ⏮
          </button>
          <button className={icon} onClick={() => go(k - 1)} disabled={!E || k === 0} aria-label="Step back" title="Step back (←)">
            ◀
          </button>
          <button
            className="grid h-9 min-w-24 place-items-center rounded-full bg-brass px-4 text-sm font-semibold text-bg hover:bg-brass2 disabled:opacity-40"
            onClick={togglePlay}
            disabled={!E}
            title="Play / pause (space)"
          >
            {playing ? "❚❚ Pause" : k >= E && E ? "↻ Replay" : "▶ Play"}
          </button>
          <button className={icon} onClick={() => go(k + 1)} disabled={!E || k >= E} aria-label="Step forward" title="Step forward (→)">
            ▶
          </button>
          <button className={icon} onClick={() => go(E)} disabled={!E || k >= E} aria-label="Last step" title="Last step (End)">
            ⏭
          </button>
        </div>
        <button className="btn btn-sm" onClick={stepOut} disabled={!canStepOut} title="Jump to the moment the current call finishes">
          ⤴ Finish this call
        </button>
        {trace?.usedFound ? (
          <button className="btn btn-sm border-good/40 text-good" onClick={nextAnswer} disabled={k >= E} title="Jump to the next answer">
            ✔ Next answer
          </button>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          Step <b className="font-mono text-ink">{k}</b> / {E}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed" className="field py-1 text-xs">
            {SPEEDS.map((o) => (
              <option key={o.ms} value={o.ms}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
      </div>
      <Timeline trace={trace} k={k} go={go} />
      {narration ? (
        <div key={`${k}-${narration.kind}`} className={`${s.narr} flex gap-3 rounded-xl border px-3 py-2 ${style.tone}`} aria-live="polite">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-current/15 text-sm font-bold">{style.icon}</span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{narration.title}</p>
            <p className="font-mono text-[12.5px] leading-relaxed text-ink/90">{narration.text}</p>
            {narration.note ? <p className="mt-0.5 text-xs text-brass2">📝 {narration.note}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StackPanel({ trace, k, visible, onPick }: { trace: Trace | null; k: number; visible: Set<string>; onPick: (id: number) => void }) {
  const chain = trace ? stackAt(trace, k) : [];
  const ev = trace && k > 0 ? trace.events[k - 1] : null;
  const returning = ev?.type === "return";
  const frames = [...chain].reverse();
  return (
    <div className="flex min-h-0 flex-col border-b border-line md:border-r md:border-b-0">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <span className="eyebrow">Call stack</span>
        <span className="ml-auto text-xs text-muted">{chain.length ? `${chain.length - 1} waiting` : ""}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!trace ? null : !chain.length ? (
          <p className="p-2 text-xs text-muted">The stack is empty: every call has finished. Step back or replay to watch it fill up.</p>
        ) : (
          <div className="grid gap-1">
            {frames.map((n, i) => (
              <button
                key={n.id}
                onClick={() => onPick(n.id)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left font-mono text-xs ${
                  i === 0
                    ? `${returning ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-brass/60 bg-brass/15 text-brass2"} ${!returning ? s.frameIn : ""}`
                    : n.isMain
                      ? "border-dashed border-line text-muted"
                      : "border-line bg-bg/60 text-ink/80"
                }`}
              >
                <span className="w-5 shrink-0 text-right text-muted">{n.depth}</span>
                <span className="min-w-0 flex-1 truncate">{sig(n, visible, 80)}</span>
                {i === 0 ? <span className="shrink-0 text-[10px] uppercase tracking-wider">{returning ? "returning ↑" : "running"}</span> : null}
                {i > 0 && !n.isMain ? <span className="shrink-0 text-[10px] text-muted">waiting</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTabs({
  trace,
  k,
  tab,
  setTab,
  visible,
  selected,
  go,
  cur,
}: {
  trace: Trace | null;
  k: number;
  tab: Tab;
  setTab: (t: Tab) => void;
  visible: Set<string>;
  selected: number | null;
  go: (k: number) => void;
  cur: TNode | null;
}) {
  const answers = trace ? trace.nodes.filter((n) => n.status === "ok") : [];
  const tabs: [Tab, string][] = [
    ["vars", "Variables"],
    ["answers", `Answers${trace?.usedFound ? ` (${answers.length})` : ""}`],
    ["output", "Output"],
    ["selected", "Selected call"],
  ];
  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line px-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-1.5 text-xs ${tab === id ? "border-brass font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {!trace ? null : tab === "vars" ? (
          <Variables trace={trace} k={k} n={cur} />
        ) : tab === "answers" ? (
          !trace.usedFound ? (
            <p className="text-xs text-muted">This code doesn&apos;t call found(), so there are no answers to list. Call found() where your code records a result.</p>
          ) : (
            <div className="grid gap-1.5">
              {answers.map((n) => {
                const choices = choicesTo(trace, n);
                const reached = n.exit < k;
                return (
                  <button
                    key={n.id}
                    onClick={() => go(n.exit + 1)}
                    className={`grid gap-1 rounded-lg border px-2.5 py-1.5 text-left text-xs ${reached ? "border-good/40 bg-good/10" : "border-line opacity-60"}`}
                  >
                    <span className="flex items-center gap-2">
                      <b className="text-good">#{n.answerNo}</b>
                      <span className="truncate font-mono">{sig(n, visible, 70)}</span>
                      <span className="ml-auto shrink-0 text-muted">{reached ? `step ${n.exit + 1}` : "not reached yet"}</span>
                    </span>
                    {choices.length ? (
                      <span className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-muted">
                        {choices.map((c, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i ? "→" : ""}
                            <span className="rounded bg-brass/15 px-1.5 text-brass2">{c}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )
        ) : tab === "output" ? (
          <div className="grid gap-1 font-mono text-xs">
            {!trace.traced.length && !trace.error ? (
              <p className="text-rose-300">No recursive function found. Declare it as function name(…) {"{ … }"} and make it call itself, or add {"// @trace name"}.</p>
            ) : null}
            {trace.logs
              .filter((l) => l.step <= k)
              .map((l, i) => (
                <div key={i} className="border-b border-dashed border-line pb-1 whitespace-pre-wrap">
                  <span className="mr-2 text-muted">step {l.step}</span>
                  {l.text}
                </div>
              ))}
            {trace.error && (k === trace.events.length || !trace.events.length) ? <p className="font-semibold whitespace-pre-wrap text-rose-300">{trace.error}</p> : null}
            {!trace.logs.some((l) => l.step <= k) && !trace.error && trace.traced.length ? <p className="text-muted">Nothing printed yet. Use log(…) or console.log(…).</p> : null}
          </div>
        ) : (
          <Selected trace={trace} id={selected} visible={visible} go={go} />
        )}
      </div>
    </div>
  );
}

/** The current call's arguments, with what changed compared with the call that made it. */
function Variables({ trace, k, n }: { trace: Trace; k: number; n: TNode | null }) {
  if (!n || n.isMain || k === 0) return <p className="text-xs text-muted">Step forward to see the arguments of each call here.</p>;
  if (k >= trace.events.length) return <p className="text-xs text-muted">The run is finished. Step back to inspect a call.</p>;
  const parent = trace.nodes[n.parent];
  const returning = trace.events[k - 1].type === "return";
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">
        {returning ? "Finishing" : "Inside"} <span className="font-mono text-ink">{n.name}(…)</span>, level {n.depth}
        {n.edge != null ? (
          <>
            {" "}
            · reached by choosing <span className="rounded bg-brass/15 px-1.5 font-mono text-brass2">{n.edge}</span>
          </>
        ) : null}
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
        {n.params.map((p, i) => {
          const pi = parent.params.indexOf(p);
          const before = !parent.isMain && pi >= 0 ? fmt(parent.args[pi]) : null;
          const now = fmt(n.args[i]);
          const changed = before !== null && before !== now;
          return (
            <div key={p} className="contents">
              <span className="text-muted">{p}</span>
              <span className="break-all">
                <span className={changed ? "rounded bg-brass/15 px-1 text-brass2" : ""}>{trunc(now, 160)}</span>
                {changed ? <span className="ml-2 text-muted">(was {trunc(before, 40)} in the caller)</span> : null}
              </span>
            </div>
          );
        })}
        {returning ? (
          <>
            <span className="text-sky-300">returns</span>
            <span className="text-sky-300">{n.hasRet ? trunc(fmt(n.ret), 160) : "nothing (undefined)"}</span>
          </>
        ) : null}
      </div>
      {n.notes.length ? <p className="text-xs text-brass2">📝 {n.notes.join(" · ")}</p> : null}
    </div>
  );
}

function Selected({ trace, id, visible, go }: { trace: Trace; id: number | null; visible: Set<string>; go: (k: number) => void }) {
  if (id === null) return <p className="text-xs text-muted">Click any box in the tree to see everything about that call.</p>;
  const n = trace.nodes[id];
  if (n.isMain) return <p className="text-xs text-muted">main is your top-level code. It made {n.children.length} traced call{n.children.length === 1 ? "" : "s"}.</p>;
  const status = { ok: "Answer found here", dead: "Dead end: no answer below", path: "Leads to at least one answer", plain: "Ordinary call", main: "" }[n.status];
  const choices = choicesTo(trace, n);
  return (
    <div className="grid gap-2 text-xs">
      <p className="font-mono text-sm text-brass2">{sig(n, visible, 120)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted">Status</dt>
        <dd>
          {status}
          {n.threw ? ", threw an error" : ""}
        </dd>
        <dt className="text-muted">Call</dt>
        <dd>
          #{n.id} of {trace.stats.calls}, level {n.depth}, {n.children.length} child call{n.children.length === 1 ? "" : "s"}
        </dd>
        {choices.length ? (
          <>
            <dt className="text-muted">Choices</dt>
            <dd className="font-mono">{choices.join(" → ")}</dd>
          </>
        ) : null}
        {n.params.map((p, i) => (
          <div key={p} className="contents">
            <dt className="font-mono text-muted">{p}</dt>
            <dd className="font-mono break-all">{fmt(n.args[i])}</dd>
          </div>
        ))}
        <dt className="text-muted">Returned</dt>
        <dd className="font-mono">{n.hasRet ? fmt(n.ret) : "nothing"}</dd>
        {n.repeatOf >= 0 ? (
          <>
            <dt className="text-violet-300">Repeated</dt>
            <dd>Same arguments as call #{n.repeatOf}: a memo would skip this whole subtree.</dd>
          </>
        ) : null}
        {n.notes.length ? (
          <>
            <dt className="text-muted">Notes</dt>
            <dd>{n.notes.join(" · ")}</dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={() => go(n.enter + 1)}>
          ↓ Go to its call
        </button>
        <button className="btn btn-sm" onClick={() => go(n.exit + 1)}>
          ↑ Go to its return
        </button>
      </div>
    </div>
  );
}

function Guide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="How to read the visualizer" className="card max-h-[90vh] w-full max-w-2xl overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div>
            <p className="eyebrow">New to recursion? Start here</p>
            <h2 className="display text-2xl text-brass2">How to read the tree</h2>
          </div>
          <button onClick={onClose} className="ml-auto text-muted hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mt-4 grid gap-4 text-sm leading-relaxed">
          <div className="grid gap-3 sm:grid-cols-2">
            <GuideCard color="border-brass/50 bg-brass/10" title="↓ A call goes down">
              Every box is one call of your function. When a call calls itself, a new box appears below it and the gold arrow shows the way down. The caller
              pauses and waits.
            </GuideCard>
            <GuideCard color="border-sky-400/50 bg-sky-400/10" title="↑ A return comes back up">
              When a call finishes, the glowing blue arrow carries control (and any return value) back up to the box that called it. That&apos;s
              backtracking: the caller resumes and tries its next option.
            </GuideCard>
            <GuideCard color="border-good/50 bg-good/10" title="✔ Answers">
              A green box called found(): it reached the goal. Green outlines mark the route that led to an answer.
            </GuideCard>
            <GuideCard color="border-rose-400/50 bg-rose-400/10" title="✕ Dead ends">
              A red dashed box finished without finding anything. The algorithm undoes its last choice and goes back up.
            </GuideCard>
          </div>
          <div>
            <h3 className="font-semibold text-ink">Watch it step by step</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>
                <b className="text-ink">Play</b> animates the whole run. <kbd>←</kbd> <kbd>→</kbd> step one move at a time, <kbd>space</kbd> plays or pauses.
              </li>
              <li>The coloured box under the controls explains each step in plain words.</li>
              <li>
                The <b className="text-ink">gold line</b> in your code is where the current call was made. A <b className="text-sky-300">blue line</b> is where control
                comes back to.
              </li>
              <li>
                The <b className="text-ink">call stack</b> (bottom left) is the list of calls waiting for each other. The top one is running, and it pops off when it
                returns.
              </li>
              <li>
                <b className="text-ink">Finish this call</b> skips to the moment the current call returns. <b className="text-ink">Next answer</b> jumps to the next
                green box. The coloured marks on the timeline are answers (green) and dead ends (red).
              </li>
              <li>
                Purple boxes are <b className="text-violet-300">repeated calls</b> with the same arguments as an earlier one. That&apos;s the wasted work a memo removes.
                Compare the two Fibonacci examples.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-ink">Writing your own code (JavaScript)</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>
                Declare the function as <code className="text-brass2">function name(…) {"{ }"}</code>. Any function that calls itself is traced. For mutual recursion
                add <code className="text-brass2">{"// @trace a, b"}</code>.
              </li>
              <li>
                <code className="text-brass2">found()</code> marks the current call as an answer. <code className="text-brass2">label(&quot;take 2&quot;)</code> names the
                next call&apos;s arrow (the choice). <code className="text-brass2">note(&quot;why&quot;)</code> adds a note to the current call.{" "}
                <code className="text-brass2">log(…)</code> prints to Output.
              </li>
              <li>
                <code className="text-brass2">{"// @show start, path"}</code> chooses which parameters show in the boxes. You can also toggle them above the tree.
              </li>
              <li>Coming from Java or C++? Drop the types, use let/const, and arrays with push / pop.</li>
              <li>Runs stop after 3,000 calls, 800 levels or 4 seconds, so keep inputs small.</li>
            </ul>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Got it, show me
          </button>
        </div>
      </div>
    </div>
  );
}

function GuideCard({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs text-muted">{children}</p>
    </div>
  );
}
