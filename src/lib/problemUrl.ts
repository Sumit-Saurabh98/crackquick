/** Client- and server-safe helpers for recognising problem links. */

export type PlatformKey = "leetcode" | "gfg";

const HOSTS: [RegExp, string, RegExp][] = [
  [/leetcode\.(com|cn)$/, "LeetCode", /\/problems\/([^/]+)/],
  [/geeksforgeeks\.org$/, "GeeksforGeeks", /\/problems\/([^/]+)/],
  [/hackerrank\.com$/, "Hackerrank", /\/challenges\/([^/]+)/],
  [/codeforces\.com$/, "Codeforces", /\/problem\/(\d+\/[A-Z]\d?)/i],
  [/interviewbit\.com$/, "InterviewBit", /\/problems\/([^/]+)/],
];

function titleFromSlug(slug: string) {
  return slug
    .replace(/[-_]\d+$/, "")
    .split(/[-_/]/)
    .filter(Boolean)
    .map((w) => (/^(i|ii|iii|iv|bst|lru|lfu)$/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** "https://leetcode.com/problems/two-sum/description/" → { platform: "LeetCode", slug: "two-sum", title: "Two Sum" } */
export function parseProblemUrl(url: string) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    for (const [hostRx, platform, pathRx] of HOSTS) {
      if (!hostRx.test(host)) continue;
      const slug = u.pathname.match(pathRx)?.[1] ?? "";
      return { platform, slug, title: slug ? titleFromSlug(slug) : "" };
    }
  } catch {
    // not a URL
  }
  return null;
}

export function leetcodeUrl(slug: string) {
  return `https://leetcode.com/problems/${slug}/`;
}

export function gfgUrl(slug: string) {
  return `https://www.geeksforgeeks.org/problems/${slug}/1`;
}

/** Canonical form used for duplicate detection, so ".../two-sum/description/" matches ".../two-sum/". */
export function canonicalProblemUrl(url: string) {
  const parsed = parseProblemUrl(url);
  if (parsed?.slug && parsed.platform === "LeetCode") return leetcodeUrl(parsed.slug);
  if (parsed?.slug && parsed.platform === "GeeksforGeeks") return gfgUrl(parsed.slug);
  return url.trim();
}
