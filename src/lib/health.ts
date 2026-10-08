import { parseProblemUrl } from "./problemUrl";
import { leetcodeBySlug, UA } from "./platforms";
import { videoLinks } from "./serialize";
import { AppConfig } from "@/models/AppConfig";
import { LinkCheck } from "@/models/LinkCheck";
import { Question } from "@/models/Question";

type Live = { _id: unknown; title: string; platform: string; platformUrl: string; pattern: string; topics: string[]; companies: string[] } & Record<string, unknown>;

async function liveQuestions(): Promise<Live[]> {
  return (await Question.find({ retired: { $ne: true } }, { title: 1, platform: 1, platformUrl: 1, pattern: 1, topics: 1, companies: 1, videoUrls: 1, videoUrl: 1 }).lean()) as unknown as Live[];
}

const YOUTUBE = /^https?:\/\/((www|m)\.)?(youtube\.com|youtu\.be)\//i;
/** Import fills a YouTube *search* when it has no video; it's a placeholder, not a video. */
export const isYoutubeSearch = (url: string) => /youtube\.com\/results\?/i.test(url);

/** Every distinct problem and video link in the live catalog. */
async function catalogLinks() {
  const links = new Map<string, "problem" | "video">();
  for (const q of await liveQuestions()) {
    if (q.platformUrl) links.set(q.platformUrl, "problem");
    for (const v of videoLinks(q)) if (!isYoutubeSearch(v)) links.set(v, "video");
  }
  return links;
}

type Result = { status: "ok" | "dead" | "unknown"; reason: string; premium: boolean };

async function httpStatus(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    return res.status;
  } catch {
    return 0;
  }
}

async function checkLink(url: string, kind: "problem" | "video", lc: Map<string, { paidOnly: boolean }> | null): Promise<Result> {
  const parsed = kind === "problem" ? parseProblemUrl(url) : null;
  if (parsed?.platform === "LeetCode" && parsed.slug && lc) {
    const hit = lc.get(parsed.slug);
    return hit ? { status: "ok", reason: "", premium: hit.paidOnly } : { status: "dead", reason: "Not found on LeetCode", premium: false };
  }
  if (kind === "video" && YOUTUBE.test(url)) {
    // oEmbed answers 404 for removed videos without loading the page.
    const code = await httpStatus(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (code === 200) return { status: "ok", reason: "", premium: false };
    if (code === 404 || code === 400) return { status: "dead", reason: "Video removed or the link is wrong", premium: false };
    return { status: "unknown", reason: code === 401 || code === 403 ? "Private or not embeddable" : "YouTube didn't answer", premium: false };
  }
  const code = await httpStatus(url);
  if (code >= 200 && code < 400) return { status: "ok", reason: "", premium: false };
  if (code === 404 || code === 410) return { status: "dead", reason: `Page not found (${code})`, premium: false };
  return { status: "unknown", reason: code ? `Site answered ${code}` : "No answer", premium: false };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Checks the next `max` links not checked since `since` (the start of this run). Called repeatedly
 * by the Health page until `remaining` is 0, so no single request runs long.
 */
export async function checkLinksBatch(since: Date, by: string, max = 50) {
  const links = await catalogLinks();
  const fresh = new Set((await LinkCheck.find({ checkedAt: { $gte: since } }, { url: 1 }).lean()).map((d) => d.url));
  const todo = [...links].filter(([url]) => !fresh.has(url));
  const batch = todo.slice(0, max);
  const lc = batch.some(([url, kind]) => kind === "problem" && parseProblemUrl(url)?.platform === "LeetCode")
    ? await leetcodeBySlug().catch(() => null)
    : null;
  const results = await mapLimit(batch, 8, ([url, kind]) => checkLink(url, kind, lc));
  if (batch.length) {
    await LinkCheck.bulkWrite(
      batch.map(([url, kind], i) => ({
        updateOne: { filter: { url }, update: { $set: { kind, ...results[i], checkedAt: new Date() } }, upsert: true },
      })),
    );
  }
  const remaining = todo.length - batch.length;
  if (!remaining) {
    await AppConfig.updateOne(
      { key: "main" },
      { $set: { lastLinkCheck: { startedAt: since, finishedAt: new Date(), checked: links.size, by } } },
      { upsert: true },
    );
  }
  return { checked: batch.length, remaining, total: links.size };
}

type Row = { _id: string; title: string; platform: string; detail?: string };

/** Everything worth fixing in the live catalog, by kind of problem. */
export async function healthReport() {
  const [questions, checks, config] = await Promise.all([
    liveQuestions(),
    LinkCheck.find({ $or: [{ status: "dead" }, { premium: true }] }).lean(),
    AppConfig.findOne({ key: "main" }, { lastLinkCheck: 1 }).lean(),
  ]);
  const dead = new Map(checks.filter((c) => c.status === "dead").map((c) => [c.url, c.reason]));
  const premium = new Set(checks.filter((c) => c.premium).map((c) => c.url));
  const row = (q: Live, detail?: string): Row => ({ _id: String(q._id), title: q.title, platform: q.platform, ...(detail ? { detail } : {}) });

  const groups: Record<string, Row[]> = {
    deadProblem: [],
    deadVideo: [],
    searchVideo: [],
    noVideo: [],
    premium: [],
    noLink: [],
    noPattern: [],
    noTopics: [],
    noCompanies: [],
  };
  for (const q of questions) {
    const videos = videoLinks(q);
    const real = videos.filter((v) => !isYoutubeSearch(v));
    if (q.platformUrl && dead.has(q.platformUrl)) groups.deadProblem.push(row(q, dead.get(q.platformUrl)));
    for (const v of real) if (dead.has(v)) groups.deadVideo.push(row(q, v));
    if (!real.length && videos.length) groups.searchVideo.push(row(q));
    if (!videos.length) groups.noVideo.push(row(q));
    if (q.platformUrl && premium.has(q.platformUrl)) groups.premium.push(row(q));
    if (!q.platformUrl) groups.noLink.push(row(q));
    if (!q.pattern) groups.noPattern.push(row(q));
    if (!q.topics?.length) groups.noTopics.push(row(q));
    if (!q.companies?.length) groups.noCompanies.push(row(q));
  }
  const last = config?.lastLinkCheck as { finishedAt?: Date; checked?: number } | null | undefined;
  return {
    total: questions.length,
    withIssues: new Set(Object.values(groups).flat().map((r) => r._id)).size,
    groups,
    lastLinkCheck: last?.finishedAt ? { at: new Date(last.finishedAt).toISOString(), checked: last.checked ?? 0 } : null,
  };
}

export type HealthJSON = Awaited<ReturnType<typeof healthReport>>;
