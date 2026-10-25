"use client";

import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { fmt } from "./engine";
import { CW, LH, PADX, PADY, sig, trunc, type Box, type TNode, type Trace } from "./analysis";
import s from "./visualizer.module.css";

export type ViewOptions = { follow: boolean; dim: boolean; trails: boolean; repeats: boolean; motion: boolean };

export type CanvasApi = { fit: () => void; zoom: (f: number) => void; center: (id: number) => void };

type Layout = { boxes: Box[]; width: number; height: number };

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const NodeView = memo(function NodeView({
  n,
  b,
  cls,
  glow,
  title,
  repeatBadge,
  badge,
  hasRet,
  returned,
}: {
  n: TNode;
  b: Box;
  cls: string;
  glow: "" | "act" | "back";
  title: string;
  repeatBadge: number;
  badge: "" | "ok" | "dead";
  hasRet: boolean;
  /** Whether this call has returned yet; its return value stays hidden until it has. */
  returned: boolean;
}) {
  return (
    <g className={cls} data-id={n.id} transform={`translate(${b.x},${b.y})`}>
      <g className={s.body}>
        {glow ? <rect className={cx(s.glow, glow === "back" && s.glowBack)} x={-5} y={-5} width={b.w + 10} height={b.h + 10} rx={13} /> : null}
        <rect className={s.box} width={b.w} height={b.h} rx={9} />
        <text className={s.txt}>
          {b.lines.map((l, i) => {
            const ret = hasRet && i === b.lines.length - 1 && l.startsWith("↩");
            return (
              <tspan key={i} x={PADX} y={PADY + 12 + i * LH} className={ret ? (returned ? s.txtRet : s.txtPending) : undefined}>
                {ret && !returned ? "↩ …" : l}
              </tspan>
            );
          })}
        </text>
        {n.notes.length ? <circle className={s.noteDot} cx={8} cy={8} r={3.2} /> : null}
        {badge === "ok" ? (
          <g className={cx(s.badge, s.badgeOk)} transform={`translate(${b.w},0)`}>
            <circle r={9} />
            <path d="M-4,0 L-1.2,2.8 L4,-2.8" />
          </g>
        ) : badge === "dead" ? (
          <g className={cx(s.badge, s.badgeDead)} transform={`translate(${b.w},0)`}>
            <circle r={9} />
            <path d="M-3.2,-3.2 L3.2,3.2 M3.2,-3.2 L-3.2,3.2" />
          </g>
        ) : null}
        {repeatBadge > 0 ? (
          <g className={cx(s.badge, s.badgeRepeat)} transform={`translate(${-6},${b.h - 8})`}>
            <rect width={26} height={15} rx={7.5} />
            <text className={s.badgeText} x={13} y={11} textAnchor="middle">
              ×{repeatBadge}
            </text>
          </g>
        ) : null}
        <title>{title}</title>
      </g>
    </g>
  );
});

const EdgeView = memo(function EdgeView({ d, cls, fresh, label, lx, ly }: { d: string; cls: string; fresh: boolean; label: string | null; lx: number; ly: number }) {
  return (
    <g className={cls}>
      <path d={d} pathLength={fresh ? 1 : undefined} />
      {label != null ? (
        <text className={s.edgeLabel} x={lx} y={ly} textAnchor="middle">
          {trunc(label, 18)}
        </text>
      ) : null}
    </g>
  );
});

function edgePath(p: Box, c: Box) {
  const px = p.cx, py = p.y + p.h, x = c.cx, y = c.y, my = (py + y) / 2;
  return { d: `M${px},${py} C${px},${my} ${x},${my} ${x},${y}`, lx: (px + x) / 2, ly: my + 4 };
}

/** The upward lane beside an edge: from the child's top back to its parent's bottom. */
function backPath(p: Box, c: Box) {
  const o = Math.min(20, c.w / 3, p.w / 3);
  const x1 = c.cx + o, y1 = c.y - 3, x2 = p.cx + o, y2 = p.y + p.h + 6, my = (y1 + y2) / 2;
  return { d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, mx: (x1 + x2) / 2, my };
}

export function TreeCanvas({
  trace,
  layout,
  k,
  visible,
  selected,
  options,
  onSelect,
  ref,
}: {
  trace: Trace;
  layout: Layout;
  k: number;
  visible: Set<string>;
  selected: number | null;
  options: ViewOptions;
  onSelect: (id: number) => void;
  ref?: Ref<CanvasApi>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, s: 1 });
  const anim = useRef<number | null>(null);
  const { boxes } = layout;
  const E = trace.events.length;

  const apply = useCallback(() => {
    const v = view.current;
    worldRef.current?.setAttribute("transform", `translate(${v.x},${v.y}) scale(${v.s})`);
    if (canvasRef.current) {
      canvasRef.current.style.backgroundSize = `${22 * v.s}px ${22 * v.s}px`;
      canvasRef.current.style.backgroundPosition = `${v.x}px ${v.y}px`;
    }
  }, []);

  const stopAnim = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  /** Eases the view to the target over ~350 ms (instantly without motion). */
  const glide = useCallback(
    (to: { x: number; y: number; s: number }) => {
      stopAnim();
      if (!options.motion) {
        view.current = to;
        apply();
        return;
      }
      const from = { ...view.current };
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 350);
        const e = 1 - Math.pow(1 - p, 3);
        view.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e };
        apply();
        anim.current = p < 1 ? requestAnimationFrame(tick) : null;
      };
      anim.current = requestAnimationFrame(tick);
    },
    [apply, options.motion],
  );

  const fit = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const W = el.clientWidth || 800, H = el.clientHeight || 500, top = 64;
    const sc = Math.max(0.06, Math.min((W - 40) / Math.max(layout.width, 1), (H - top - 24) / Math.max(layout.height, 1), 1.35));
    glide({ s: sc, x: (W - layout.width * sc) / 2, y: top });
  }, [glide, layout.width, layout.height]);

  /** The whole tree if it's readable that small; otherwise readable size, starting at the top. */
  const start = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const W = el.clientWidth || 800, H = el.clientHeight || 500, top = 64;
    const sc = Math.min((W - 40) / Math.max(layout.width, 1), (H - top - 24) / Math.max(layout.height, 1), 1.35);
    if (sc >= 0.8) return fit();
    const root = boxes[0];
    view.current = { s: 0.9, x: W / 2 - (root?.cx ?? 0) * 0.9, y: top };
    apply();
  }, [fit, apply, boxes, layout.width, layout.height]);

  const zoomAt = useCallback(
    (f: number, mx: number, my: number) => {
      stopAnim();
      const v = view.current;
      const ns = Math.min(3, Math.max(0.05, v.s * f));
      const wx = (mx - v.x) / v.s, wy = (my - v.y) / v.s;
      view.current = { s: ns, x: mx - wx * ns, y: my - wy * ns };
      apply();
    },
    [apply],
  );

  const center = useCallback(
    (id: number, force = true) => {
      const el = svgRef.current, b = boxes[id];
      if (!el || !b) return;
      const v = view.current, W = el.clientWidth, H = el.clientHeight, m = 70;
      const sx = b.cx * v.s + v.x, sy = (b.y + b.h / 2) * v.s + v.y;
      if (force || sx < m || sx > W - m || sy < m + 50 || sy > H - m) glide({ s: v.s, x: W / 2 - b.cx * v.s, y: H / 2 - (b.y + b.h / 2) * v.s });
    },
    [boxes, glide],
  );

  useImperativeHandle(ref, () => ({ fit, zoom: (f) => zoomAt(f, (svgRef.current?.clientWidth ?? 0) / 2, (svgRef.current?.clientHeight ?? 0) / 2), center }), [fit, zoomAt, center]);

  // When the canvas changes size (panels shown, hidden or dragged), keep what was in the middle in the middle.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    let last = { w: el.clientWidth, h: el.clientHeight };
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h || (w === last.w && h === last.h)) return;
      view.current = { ...view.current, x: view.current.x + (w - last.w) / 2, y: view.current.y + (h - last.h) / 2 };
      last = { w, h };
      apply();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply]);

  // A new run (or new box sizes): start view.
  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const curId = k > 0 && k < E ? trace.events[k - 1].id : k === 0 ? 0 : -1;
  useEffect(() => {
    if (options.follow && curId > 0) center(curId, false);
  }, [curId, options.follow, center]);

  /** For each node, the step its subtree's first answer comes back (so green paths appear only once earned). */
  const firstWin = useMemo(() => {
    const out = new Array<number>(trace.nodes.length).fill(Infinity);
    for (let i = trace.nodes.length - 1; i >= 0; i--) {
      const n = trace.nodes[i];
      let w = n.found ? n.exit : Infinity;
      for (const c of n.children) w = Math.min(w, out[c]);
      out[i] = w;
    }
    return out;
  }, [trace]);

  const ev = k > 0 ? trace.events[k - 1] : null;
  const freshId = ev?.type === "call" ? ev.id : -1;
  const backId = ev?.type === "return" ? ev.id : -1;

  const onStack = useMemo(() => {
    const set = new Set<number>();
    if (k >= E) return set;
    for (let n: TNode | undefined = trace.nodes[curId < 0 ? 0 : curId]; n; n = n.parent >= 0 ? trace.nodes[n.parent] : undefined) set.add(n.id);
    return set;
  }, [trace, curId, k, E]);

  /* ---- pointer: drag to pan, pinch / wheel to zoom, click to select ---- */
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ drag: { x: number; y: number; vx: number; vy: number } | null; pinch: { d: number; s: number; vx: number; vy: number; mx: number; my: number } | null; moved: boolean; down: number | null }>({
    drag: null,
    pinch: null,
    moved: false,
    down: null,
  });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX - r.left, e.clientY - r.top);
      else {
        stopAnim();
        view.current.x -= e.deltaX;
        apply();
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt, apply]);

  function onDown(e: React.PointerEvent<SVGSVGElement>) {
    const g = (e.target as Element).closest?.("[data-id]") as SVGGElement | null;
    const G = gesture.current;
    G.down = g ? Number(g.dataset.id) : null;
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    G.moved = false;
    stopAnim();
    const v = view.current;
    if (ptrs.current.size === 1) G.drag = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
    else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: v.s, vx: v.x, vy: v.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      G.drag = null;
      G.moved = true;
    }
    svgRef.current?.classList.add(s.dragging);
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = gesture.current;
    const r = e.currentTarget.getBoundingClientRect();
    if (G.pinch && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const P = G.pinch;
      const ns = Math.min(3, Math.max(0.05, (P.s * Math.hypot(a.x - b.x, a.y - b.y)) / P.d));
      const wx = (P.mx - r.left - P.vx) / P.s, wy = (P.my - r.top - P.vy) / P.s;
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      view.current = { s: ns, x: mx - wx * ns, y: my - wy * ns };
      apply();
    } else if (G.drag) {
      const dx = e.clientX - G.drag.x, dy = e.clientY - G.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) G.moved = true;
      view.current = { ...view.current, x: G.drag.vx + dx, y: G.drag.vy + dy };
      apply();
    }
  }

  function onUp(e: React.PointerEvent<SVGSVGElement>) {
    ptrs.current.delete(e.pointerId);
    const G = gesture.current;
    if (ptrs.current.size < 2) G.pinch = null;
    if (ptrs.current.size === 0) {
      svgRef.current?.classList.remove(s.dragging);
      if (!G.moved && G.down !== null) onSelect(G.down);
      G.drag = null;
      G.down = null;
    }
  }

  /* ---- what each node and edge looks like at step k ---- */
  const parts = trace.nodes.map((n) => {
    const b = boxes[n.id];
    const vis = n.isMain || n.enter < k;
    const act = vis && onStack.has(n.id) && k < E;
    const isCur = n.id === curId && k > 0 && k < E;
    const won = firstWin[n.id] < k;
    const status =
      n.status === "main" ? s.main : n.status === "ok" ? s.ok : n.status === "dead" && n.exit < k ? s.dead : won && n.status === "path" ? s.path : null;
    const repeat = options.repeats && n.repeatOf >= 0 && !n.found;
    const dimmed = options.dim && k > 0 && k < E && vis && !onStack.has(n.id);
    const cls = cx(s.node, status, repeat && s.repeat, act && s.act, isCur && s.cur, n.id === selected && s.sel, !vis && s.hid, dimmed && s.dim, n.id === freshId && s.fresh);
    const badge: "" | "ok" | "dead" = n.status === "ok" && vis ? "ok" : n.status === "dead" && n.exit < k ? "dead" : "";
    const repeatBadge = options.repeats && vis && n.repeatOf < 0 && n.repeats > 1 ? n.repeats : 0;
    const glow: "" | "act" | "back" = isCur ? "act" : n.id === backId ? "back" : "";
    let edge = null;
    if (n.parent >= 0) {
      const { d, lx, ly } = edgePath(boxes[n.parent], b);
      const fresh = n.id === freshId;
      edge = { d, lx, ly, fresh, cls: cx(s.edge, won && s.edgeWin, act && s.edgeAct, fresh && s.edgeFresh, !vis && s.hid, dimmed && s.dim) };
    }
    return { n, b, cls, badge, repeatBadge, glow, edge };
  });

  /* ---- the arrow for the step that just returned ---- */
  let back = null;
  if (backId > 0) {
    const n = trace.nodes[backId];
    const { d, mx, my } = backPath(boxes[n.parent], boxes[n.id]);
    const text = n.status === "ok" ? "✔ answer · backtrack" : n.status === "dead" ? "✕ dead end · backtrack" : n.hasRet ? `↩ returns ${trunc(fmt(n.ret), 16)}` : "↶ backtrack";
    const w = text.length * CW + 18;
    back = (
      <g className={s.back} key={`back-${k}`}>
        <path className={s.backLine} d={d} pathLength={1} markerEnd="url(#rvUpHead)" />
        <path className={s.backFlow} d={d} />
        <circle className={s.backDot} r={5}>
          <animateMotion dur="0.9s" repeatCount="indefinite" path={d} />
        </circle>
        {/* The position sits on an outer group: a CSS animation's transform would replace the attribute. */}
        <g transform={`translate(${mx + 14},${my - 11})`}>
          <g className={cx(s.pill, n.status === "dead" && s.pillDead, n.status === "ok" && s.pillOk)}>
            <rect width={w} height={22} rx={11} />
            <text x={w / 2} y={15} textAnchor="middle">
              {text}
            </text>
          </g>
        </g>
      </g>
    );
  }

  let trails = null;
  if (options.trails) {
    trails = trace.nodes
      .filter((n) => n.parent >= 0 && n.exit < k - 1 && n.id !== backId)
      .slice(0, 1500)
      .map((n) => <path key={n.id} className={s.trail} d={backPath(boxes[n.parent], boxes[n.id]).d} markerEnd="url(#rvTrailHead)" />);
  }

  return (
    <div ref={canvasRef} className={cx(s.canvas, "h-full w-full", !options.motion && s.noMotion)}>
      <svg
        ref={svgRef}
        className={s.svg}
        role="img"
        aria-label="Recursion tree"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <marker id="rvUpHead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className={s.backHead} />
          </marker>
          <marker id="rvTrailHead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="rgba(95,180,255,.5)" />
          </marker>
        </defs>
        <g ref={worldRef}>
          {trails}
          {parts.map((p) => (p.edge ? <EdgeView key={p.n.id} d={p.edge.d} cls={p.edge.cls} fresh={p.edge.fresh} label={p.n.edge} lx={p.edge.lx} ly={p.edge.ly} /> : null))}
          {parts.map((p) => (
            <NodeView key={p.n.id} n={p.n} b={p.b} cls={p.cls} glow={p.glow} title={sig(p.n, visible, 200)} repeatBadge={p.repeatBadge} badge={p.badge} hasRet={p.n.hasRet} returned={p.n.exit < k} />
          ))}
          {back}
        </g>
      </svg>
    </div>
  );
}
