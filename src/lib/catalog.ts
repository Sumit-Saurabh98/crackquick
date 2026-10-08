import { HttpError } from "./attempts";
import { DIFFICULTIES } from "./constants";
import { csv } from "./http";
import { canonicalNames } from "./options";
import { canonicalProblemUrl } from "./problemUrl";
import { videoLinks } from "./serialize";
import { Question } from "@/models/Question";

/** The shared, admin-owned fields of a question. Everything else on a question is per user. */
export type CatalogFields = {
  title: string;
  platform: string;
  platformUrl: string;
  externalId: string;
  videoUrls: string[];
  topics: string[];
  companies: string[];
  difficulty: (typeof DIFFICULTIES)[number];
  pattern: string;
};

export const CATALOG_KEYS = [
  "title",
  "platform",
  "platformUrl",
  "externalId",
  "videoUrls",
  "topics",
  "companies",
  "difficulty",
  "pattern",
] as const satisfies readonly (keyof CatalogFields)[];

const text = (v: unknown) => String(v ?? "").trim();

/** The catalog fields present in a request body, cleaned. Fields not sent are left out. */
export function catalogInput(body: Record<string, unknown>): Partial<CatalogFields> {
  const out: Partial<CatalogFields> = {};
  if (body.title !== undefined) out.title = text(body.title);
  if (body.platform !== undefined) out.platform = text(body.platform);
  if (body.platformUrl !== undefined) out.platformUrl = text(body.platformUrl) ? canonicalProblemUrl(text(body.platformUrl)) : "";
  if (body.externalId !== undefined) out.externalId = text(body.externalId);
  if (body.videoUrls !== undefined || body.videoUrl !== undefined) out.videoUrls = videoLinks(body);
  if (body.topics !== undefined) out.topics = csv(body.topics);
  if (body.companies !== undefined) out.companies = csv(body.companies);
  if (body.difficulty !== undefined) {
    const d = DIFFICULTIES.find((x) => x === body.difficulty);
    if (!d) throw new HttpError("Difficulty must be Easy, Medium or Hard.", 400);
    out.difficulty = d;
  }
  if (body.pattern !== undefined) out.pattern = text(body.pattern);
  if (out.title === "") throw new HttpError("Title is required.", 400);
  return out;
}

/** A question's current catalog fields. */
export function catalogOf(doc: Record<string, unknown>): CatalogFields {
  return {
    title: String(doc.title ?? ""),
    platform: String(doc.platform ?? ""),
    platformUrl: String(doc.platformUrl ?? ""),
    externalId: String(doc.externalId ?? ""),
    videoUrls: videoLinks(doc),
    topics: Array.isArray(doc.topics) ? doc.topics.map(String) : [],
    companies: Array.isArray(doc.companies) ? doc.companies.map(String) : [],
    difficulty: DIFFICULTIES.find((d) => d === doc.difficulty) ?? "Medium",
    pattern: String(doc.pattern ?? ""),
  };
}

/** Uses the Platforms / Patterns lists' spelling, adding names that are new to them. */
export async function withCanonicalNames<T extends Partial<CatalogFields>>(fields: T): Promise<T> {
  const out = { ...fields };
  if (out.platform !== undefined) out.platform = (await canonicalNames("platform", [out.platform]))(out.platform);
  if (out.pattern !== undefined) out.pattern = (await canonicalNames("pattern", [out.pattern]))(out.pattern);
  return out;
}

/** The proposed fields that differ from the current ones, with their current values alongside. */
export function diffCatalog(current: CatalogFields, proposed: Partial<CatalogFields>) {
  const data: Partial<CatalogFields> = {};
  const before: Partial<CatalogFields> = {};
  for (const k of CATALOG_KEYS) {
    if (proposed[k] === undefined) continue;
    if (JSON.stringify(proposed[k]) === JSON.stringify(current[k])) continue;
    Object.assign(data, { [k]: proposed[k] });
    Object.assign(before, { [k]: current[k] });
  }
  return { data, before };
}

/** Id of a catalog question with this problem link (ignoring case and older link styles), if any. */
export async function findByProblemUrl(url: string, exceptId?: unknown): Promise<string | null> {
  const key = canonicalProblemUrl(url).toLowerCase();
  if (!key) return null;
  const filter: Record<string, unknown> = { platformUrl: { $ne: "" } };
  if (exceptId) filter._id = { $ne: exceptId };
  const docs = await Question.find(filter, { platformUrl: 1 }).lean();
  const hit = docs.find((d) => canonicalProblemUrl(String(d.platformUrl)).toLowerCase() === key);
  return hit ? String(hit._id) : null;
}
