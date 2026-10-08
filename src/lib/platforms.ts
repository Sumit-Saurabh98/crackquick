import companyData from "@/data/leetcode-companies.json";
import { gfgUrl, leetcodeUrl, parseProblemUrl, type PlatformKey } from "./problemUrl";

/** A problem fetched from LeetCode / GeeksforGeeks, shaped like an importable question. */
export type FoundProblem = {
  externalId: string;
  title: string;
  platform: "LeetCode" | "GeeksforGeeks";
  platformUrl: string;
  videoUrl: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topics: string[];
  companies: string[];
  paidOnly: boolean;
};

export type LookupResult = { items: FoundProblem[]; errors: string[] };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
const MAX_ITEMS = 100;

function videoSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return res.json() as Promise<T>;
}

/** Splits "1, 15 146\n200-205" into tokens. Names may contain spaces, so only commas/newlines split them. */
function tokens(input: string) {
  return input
    .split(/[,\n;]+/)
    .map((t) => t.trim().replace(/\s*-\s*(?=\d)/g, "-"))
    .flatMap((t) => (/^[\d\s-]+$/.test(t) ? t.split(/\s+/) : [t]))
    .filter(Boolean);
}

function dedupe(items: FoundProblem[]) {
  const seen = new Set<string>();
  return items.filter((p) => (seen.has(p.platformUrl) ? false : (seen.add(p.platformUrl), true)));
}

// ---------------------------------------------------------------- LeetCode

/**
 * LeetCode only shows company tags to Premium users, so they come from a community dataset
 * (src/data/leetcode-companies.json, rebuilt with `npm run update:companies`). Biggest companies first.
 */
export function leetcodeCompanies(slug: string): string[] {
  const ids = (companyData.problems as Record<string, number[]>)[slug] ?? [];
  return ids.map((i) => companyData.companies[i]);
}

type LcIndexEntry = { id: string; slug: string };
let lcIndex: { at: number; byId: Map<string, LcIndexEntry> } | null = null;

/** id → slug for every LeetCode problem, cached in memory for a day. */
async function leetcodeIndex() {
  if (lcIndex && Date.now() - lcIndex.at < 86400000) return lcIndex.byId;
  type All = { stat_status_pairs: { stat: { frontend_question_id: number | string; question__title_slug: string } }[] };
  const data = await getJson<All>("https://leetcode.com/api/problems/all/");
  const byId = new Map<string, LcIndexEntry>();
  for (const { stat } of data.stat_status_pairs) {
    const id = String(stat.frontend_question_id);
    byId.set(id, { id, slug: stat.question__title_slug });
  }
  lcIndex = { at: Date.now(), byId };
  return byId;
}

type LcQuestion = {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  isPaidOnly: boolean;
  topicTags: { name: string }[];
};
const LC_FIELDS = "questionFrontendId title titleSlug difficulty isPaidOnly topicTags { name }";

async function leetcodeGraphql<T>(query: string, variables: Record<string, unknown> = {}) {
  const res = await getJson<{ data?: T; errors?: { message: string }[] }>("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.data) throw new Error(res.errors?.[0]?.message ?? "LeetCode lookup failed");
  return res.data;
}

/** Fetches full details for many slugs with one aliased GraphQL request per 40 slugs. */
async function leetcodeBySlugs(slugs: string[]) {
  const out = new Map<string, LcQuestion>();
  for (let i = 0; i < slugs.length; i += 40) {
    const chunk = slugs.slice(i, i + 40);
    const query = `query { ${chunk.map((s, j) => `q${j}: question(titleSlug: ${JSON.stringify(s)}) { ${LC_FIELDS} }`).join(" ")} }`;
    const data = await leetcodeGraphql<Record<string, LcQuestion | null>>(query);
    chunk.forEach((s, j) => {
      const q = data[`q${j}`];
      if (q) out.set(s, q);
    });
  }
  return out;
}

async function leetcodeSearch(name: string) {
  const data = await leetcodeGraphql<{ questionList: { data: LcQuestion[] } }>(
    `query q($filters: QuestionListFilterInput) { questionList(categorySlug: "", limit: 5, skip: 0, filters: $filters) { data { ${LC_FIELDS} } } }`,
    { filters: { searchKeywords: name } },
  );
  const list = data.questionList.data;
  return list.find((q) => q.title.toLowerCase() === name.toLowerCase()) ?? list[0] ?? null;
}

function fromLeetcode(q: LcQuestion): FoundProblem {
  const topics = q.topicTags.map((t) => t.name);
  return {
    externalId: q.questionFrontendId,
    title: q.title,
    platform: "LeetCode",
    platformUrl: leetcodeUrl(q.titleSlug),
    videoUrl: videoSearchUrl(`leetcode ${q.questionFrontendId} ${q.title}`),
    difficulty: q.difficulty,
    topics,
    companies: leetcodeCompanies(q.titleSlug),
    paidOnly: q.isPaidOnly,
  };
}

async function lookupLeetcode(input: string, max: number): Promise<LookupResult> {
  const errors: string[] = [];
  // Keep the user's order: each entry is a number, a slug, or a name to search.
  const entries: { kind: "id" | "slug" | "name"; value: string }[] = [];

  for (const t of tokens(input)) {
    const range = t.match(/^(\d+)-(\d+)$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
      if (b - a >= max) errors.push(`Range ${t} is too big (max ${max}).`);
      else for (let n = a; n <= b; n++) entries.push({ kind: "id", value: String(n) });
    } else if (/^\d+$/.test(t)) entries.push({ kind: "id", value: String(Number(t)) });
    else if (/^https?:\/\//.test(t)) {
      const p = parseProblemUrl(t);
      if (p?.platform === "LeetCode" && p.slug) entries.push({ kind: "slug", value: p.slug });
      else errors.push(`Not a LeetCode problem link: ${t}`);
    } else if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t)) entries.push({ kind: "slug", value: t });
    else entries.push({ kind: "name", value: t });
  }
  if (entries.length > max) return { items: [], errors: [tooMany(max)] };

  const index = entries.some((e) => e.kind === "id") ? await leetcodeIndex() : null;
  for (const e of entries) {
    if (e.kind !== "id") continue;
    const hit = index?.get(e.value);
    if (hit) Object.assign(e, { kind: "slug", value: hit.slug });
    else errors.push(`LeetCode #${e.value} not found.`);
  }

  const bySlug = await leetcodeBySlugs([...new Set(entries.filter((e) => e.kind === "slug").map((e) => e.value))]);
  const items: FoundProblem[] = [];
  for (const e of entries) {
    if (e.kind === "slug") {
      const q = bySlug.get(e.value);
      if (q) items.push(fromLeetcode(q));
      else errors.push(`LeetCode problem "${e.value}" not found.`);
    } else if (e.kind === "name") {
      const q = await leetcodeSearch(e.value);
      if (q) items.push(fromLeetcode(q));
      else errors.push(`No LeetCode problem matches "${e.value}".`);
    }
  }
  return { items: dedupe(items), errors };
}

// ---------------------------------------------------------- GeeksforGeeks

type GfgProblem = {
  id: number | string;
  problem_name: string;
  slug: string;
  difficulty: string;
  tags?: { company_tags?: string[]; topic_tags?: string[] };
};

export function fromGfg(p: GfgProblem): FoundProblem {
  const topics = p.tags?.topic_tags ?? [];
  const difficulty = /hard/i.test(p.difficulty) ? "Hard" : /medium/i.test(p.difficulty) ? "Medium" : "Easy"; // School / Basic → Easy
  return {
    externalId: String(p.id),
    title: p.problem_name,
    platform: "GeeksforGeeks",
    platformUrl: gfgUrl(p.slug),
    videoUrl: videoSearchUrl(`gfg ${p.problem_name}`),
    difficulty,
    topics,
    companies: p.tags?.company_tags ?? [],
    paidOnly: false,
  };
}

/** GFG detail endpoint accepts either the numeric problem id or the slug. */
export async function gfgDetail(key: string) {
  try {
    const data = await getJson<{ results?: GfgProblem }>(
      `https://practiceapi.geeksforgeeks.org/api/latest/problems/${encodeURIComponent(key)}/`,
    );
    return data.results?.problem_name ? data.results : null;
  } catch {
    return null;
  }
}

async function gfgSearch(name: string) {
  const data = await getJson<{ results?: GfgProblem[] }>(
    `https://practiceapi.geeksforgeeks.org/api/vr/problems/?pageMode=explore&page=1&searchQuery=${encodeURIComponent(name)}`,
  );
  const list = data.results ?? [];
  return list.find((p) => p.problem_name.toLowerCase() === name.toLowerCase()) ?? list[0] ?? null;
}

async function lookupGfg(input: string, max: number): Promise<LookupResult> {
  const errors: string[] = [];
  const list = tokens(input);
  if (list.length > max) return { items: [], errors: [tooMany(max)] };

  const items: FoundProblem[] = [];
  // Small batches keep GFG happy and still finish 100 lookups in a few seconds.
  for (let i = 0; i < list.length; i += 6) {
    const batch = await Promise.all(
      list.slice(i, i + 6).map(async (t): Promise<FoundProblem | string> => {
        if (/^https?:\/\//.test(t)) {
          const p = parseProblemUrl(t);
          if (p?.platform !== "GeeksforGeeks" || !p.slug) return `Not a GeeksforGeeks problem link: ${t}`;
          const hit = await gfgDetail(p.slug);
          return hit ? fromGfg(hit) : `GFG problem not found: ${t}`;
        }
        if (/^\d+$/.test(t) || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(t)) {
          const hit = await gfgDetail(t);
          return hit ? fromGfg(hit) : `GFG problem "${t}" not found.`;
        }
        const hit = await gfgSearch(t);
        return hit ? fromGfg(hit) : `No GFG problem matches "${t}".`;
      }),
    );
    for (const r of batch) {
      if (typeof r === "string") errors.push(r);
      else items.push(r);
    }
  }
  return { items: dedupe(items), errors };
}

function tooMany(max: number) {
  return max === 1 ? "One problem at a time: enter a single number, link or name." : `Too many at once: max ${max} per lookup.`;
}

/** `max` caps how many problems one lookup may fetch (default 100). */
export async function lookupProblems(platform: PlatformKey, input: string, max = MAX_ITEMS): Promise<LookupResult> {
  if (!input.trim()) return { items: [], errors: ["Enter at least one number, link or name."] };
  return platform === "gfg" ? lookupGfg(input, max) : lookupLeetcode(input, max);
}
