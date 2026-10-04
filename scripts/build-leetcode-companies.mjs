// Builds src/data/leetcode-companies.json from the community dataset
// https://github.com/liquidslr/leetcode-company-wise-problems (LeetCode itself only exposes company tags to Premium users).
// Run: npm run update:companies
import { writeFile } from "node:fs/promises";

const REPO = "liquidslr/leetcode-company-wise-problems";
const BRANCH = "main";
const OUT = new URL("../src/data/leetcode-companies.json", import.meta.url);

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const tree = await (await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`)).json();
const files = tree.tree.filter((x) => x.type === "blob" && x.path.endsWith("/5. All.csv")).map((x) => x.path);
console.log(`${files.length} companies`);

/** slug -> [{ company, freq }] */
const bySlug = new Map();
let done = 0;
for (let i = 0; i < files.length; i += 20) {
  await Promise.all(
    files.slice(i, i + 20).map(async (path) => {
      const company = path.split("/")[0];
      const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path.split("/").map(encodeURIComponent).join("/")}`;
      const res = await fetch(url);
      if (!res.ok) return console.warn(`skip ${company}: ${res.status}`);
      const [header, ...rows] = (await res.text()).split(/\r?\n/).filter(Boolean);
      const cols = parseCsvLine(header);
      const linkCol = cols.indexOf("Link");
      const freqCol = cols.indexOf("Frequency");
      for (const row of rows) {
        const cells = parseCsvLine(row);
        const slug = cells[linkCol]?.match(/\/problems\/([^/]+)/)?.[1];
        if (!slug) continue;
        const list = bySlug.get(slug) ?? [];
        list.push({ company, freq: Number(cells[freqCol]) || 0 });
        bySlug.set(slug, list);
      }
      done += 1;
    }),
  );
  process.stdout.write(`\r${done}/${files.length}`);
}

// "Frequency" is relative within one company (its most-asked = 100), so it can't rank companies against
// each other. Rank by how many problems a company has in the dataset instead: big-tech names come first.
const size = new Map();
for (const list of bySlug.values()) for (const { company } of list) size.set(company, (size.get(company) ?? 0) + 1);

// Compact form: a company name table (largest first) plus slug -> company indexes, every company kept.
const companies = [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || a.localeCompare(b));
const index = new Map(companies.map((c, i) => [c, i]));
const problems = {};
for (const [slug, list] of [...bySlug.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  problems[slug] = [...new Set(list.map((x) => index.get(x.company)))].sort((a, b) => a - b);
}
await writeFile(
  OUT,
  JSON.stringify({ source: `https://github.com/${REPO}`, generatedAt: new Date().toISOString(), companies, problems }),
);
console.log(`\nwrote ${Object.keys(problems).length} problems, ${companies.length} companies`);
