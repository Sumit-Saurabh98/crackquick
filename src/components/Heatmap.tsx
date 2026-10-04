"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LABEL_COL = 28;
const GAP = 3;
const MIN_CELL = 11;

type Cell = { date: string; count: number; future?: boolean };

function level(count: number) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

/**
 * Monday-start weekly columns, IST dates from /api/stats. Shows the most recent weeks that fit the
 * container at >= MIN_CELL px per square, then stretches them to fill the full width.
 */
export function Heatmap({ cells }: { cells: Cell[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allWeeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) allWeeks.push(cells.slice(i, i + 7));
  const fit = width ? Math.floor((width - LABEL_COL + GAP) / (MIN_CELL + GAP)) : allWeeks.length;
  const weeks = allWeeks.slice(-Math.max(1, Math.min(allWeeks.length, fit)));
  const shown = weeks.flat();
  const total = shown.reduce((s, c) => s + c.count, 0);
  const active = shown.filter((c) => c.count > 0).length;

  // Label each week by its last day's month (a Sep 28 – Oct 4 week reads "Oct"); skip labels that would collide.
  const monthOf = (w: Cell[]) => Number(w[w.length - 1].date.slice(5, 7)) - 1;
  const labels: string[] = [];
  let lastLabel = -3;
  weeks.forEach((w, i) => {
    const month = monthOf(w);
    const prev = i > 0 ? monthOf(weeks[i - 1]) : -1;
    const show = month !== prev && i - lastLabel >= 3 && i < weeks.length - 2;
    if (show) lastLabel = i;
    labels.push(show ? MONTHS[month] : "");
  });

  return (
    <div ref={ref} className="w-full">
      <div
        className="grid w-full"
        style={{ gridTemplateColumns: `${LABEL_COL}px repeat(${weeks.length}, minmax(0, 1fr))`, gap: GAP }}
      >
        <span />
        {weeks.map((w, i) => (
          <span key={w[0].date} className="h-3 overflow-visible whitespace-nowrap text-[10px] leading-3 text-muted">
            {labels[i]}
          </span>
        ))}
        {Array.from({ length: 7 }, (_, row) => (
          <Row key={row} row={row} weeks={weeks} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {total} attempts on {active} days · last {weeks.length} weeks
        </span>
        <span className="flex items-center gap-1">
          less
          {COLORS.map((c) => (
            <span key={c} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: c }} />
          ))}
          more
        </span>
      </div>
    </div>
  );
}

function Row({ row, weeks }: { row: number; weeks: Cell[][] }) {
  return (
    <>
      <span className="self-center text-[10px] leading-none text-muted">{["Mon", "", "Wed", "", "Fri", "", "Sun"][row]}</span>
      {weeks.map((w) => {
        const c = w[row];
        if (!c) return <span key={`${w[0].date}-${row}`} />;
        return (
          <span
            key={c.date}
            title={`${c.date}: ${c.count} attempt${c.count === 1 ? "" : "s"}`}
            className="aspect-square w-full rounded-[3px]"
            style={{ background: COLORS[level(c.count)], opacity: c.future ? 0.25 : 1 }}
          />
        );
      })}
    </>
  );
}
