import { DEFAULT_TIMEZONE } from "./constants";

/**
 * Calendar helpers in the user's timezone (Settings → Timezone, default IST). On the server each
 * request resolves its own user's timezone (`requestContext.ts`); the browser gets it from the root
 * layout (`TimezoneInit`), so both agree on "today".
 */

export type Ymd = { y: number; m: number; d: number };

const DAY = 86400000;

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

let currentTz = DEFAULT_TIMEZONE;
let resolveTz: (() => string | undefined) | null = null;

/** Browser only: one user per tab, so a module-level value is fine. */
export function setTimezone(tz: string | null | undefined) {
  currentTz = tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Server: looks the timezone up per request, since concurrent requests belong to different users. */
export function setTimezoneResolver(fn: () => string | undefined) {
  resolveTz = fn;
}

/** "India Standard Time (GMT+5:30)" style label for a timezone. */
export function timezoneLabel(tz: string) {
  const name = (style: "long" | "shortOffset") =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${name("long")} (${name("shortOffset")})`;
}

export function getTimezone() {
  return resolveTz?.() ?? currentTz;
}

function parts(date: Date, withTime: boolean) {
  const out = new Intl.DateTimeFormat("en-US", {
    timeZone: getTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(date);
  const get = (type: string) => Number(out.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

export function zonedYmd(date = new Date()): Ymd {
  const { y, m, d } = parts(date, false);
  return { y, m, d };
}

/** Milliseconds the timezone is ahead of UTC at `date` (handles DST). */
function offsetMs(date: Date) {
  const p = parts(date, true);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant of local midnight (+ optional hour) on a calendar day. */
export function zonedMidnight({ y, m, d }: Ymd, hour = 0) {
  const guess = Date.UTC(y, m - 1, d, hour);
  let t = guess - offsetMs(new Date(guess));
  const corrected = guess - offsetMs(new Date(t));
  if (corrected !== t) t = corrected;
  return new Date(t);
}

export function startOfToday(now = new Date()) {
  return zonedMidnight(zonedYmd(now));
}

export function addCalendarDays(ymd: Ymd, days: number): Ymd {
  const utc = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() };
}

/** Local midnight `days` calendar days after the day containing `from`. */
export function addDays(from: Date, days: number) {
  return zonedMidnight(addCalendarDays(zonedYmd(from), days));
}

export function ymdKey(ymd: Ymd) {
  return `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
}

export function parseYmdKey(key: string): Ymd | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** "YYYY-MM-DD" of `date` in the user's timezone (also the value format of <input type="date">). */
export function dateKey(date = new Date()) {
  return ymdKey(zonedYmd(date));
}

export function formatDate(date?: Date | string | null, withTime = false) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: getTimezone(),
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function daysBetweenYmd(a: Ymd, b: Ymd) {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY);
}

/** Monday-start weekday 0-6. */
export function mondayIndex(ymd: Ymd) {
  return (new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay() + 6) % 7;
}

function shiftMonths({ y, m }: Ymd, months: number): Ymd {
  const idx = y * 12 + (m - 1) + months;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1, d: 1 };
}

function periodStart(period: string, today: Ymd): Ymd | null {
  switch (period) {
    case "week":
      return addCalendarDays(today, -mondayIndex(today));
    case "month":
      return { ...today, d: 1 };
    case "quarter":
      return { y: today.y, m: Math.floor((today.m - 1) / 3) * 3 + 1, d: 1 };
    case "half":
      return { y: today.y, m: today.m <= 6 ? 1 : 7, d: 1 };
    case "year":
      return { y: today.y, m: 1, d: 1 };
    case "all":
      return null;
    default:
      return today;
  }
}

export function periodRange(period: string, now = new Date()) {
  const today = zonedYmd(now);
  const start = periodStart(period, today);
  return { from: start ? zonedMidnight(start) : new Date(0), to: zonedMidnight(addCalendarDays(today, 1)) };
}

/**
 * The same elapsed span at the start of the previous window, e.g. Mon–Wed of last
 * week when today is Wednesday. Null for "all".
 */
export function previousPeriodRange(period: string, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const start = zonedYmd(from);
  const shifts: Record<string, () => Ymd> = {
    week: () => addCalendarDays(start, -7),
    month: () => shiftMonths(start, -1),
    quarter: () => shiftMonths(start, -3),
    half: () => shiftMonths(start, -6),
    year: () => shiftMonths(start, -12),
  };
  if (period === "all") return null;
  const prevFrom = zonedMidnight(shifts[period]?.() ?? addCalendarDays(start, -1));
  return { from: prevFrom, to: new Date(Math.min(from.getTime(), prevFrom.getTime() + (to.getTime() - from.getTime()))) };
}
