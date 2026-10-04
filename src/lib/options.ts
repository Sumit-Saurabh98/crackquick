import { HttpError } from "./attempts";
import { ListOption } from "@/models/ListOption";
import { Question } from "@/models/Question";

/** Dropdowns the user manages, and the question field each one fills. */
export const OPTION_KINDS = {
  platform: { field: "platform", label: "Platform" },
  pattern: { field: "pattern", label: "Pattern" },
} as const;

export type OptionKind = keyof typeof OPTION_KINDS;

export type OptionJSON = { _id: string; name: string; count: number };

export function parseKind(raw: unknown): OptionKind {
  if (raw === "platform" || raw === "pattern") return raw;
  throw new HttpError("kind must be platform or pattern.", 400);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Matches the stored value case-insensitively, so "leetcode" and "LeetCode" count as one. */
const sameName = (name: string) => ({ $regex: `^${escapeRegex(name)}$`, $options: "i" });
const clean = (name: unknown) => String(name ?? "").trim().replace(/\s+/g, " ");
const keyOf = (name: string) => name.toLowerCase();

/** Makes sure each name exists in the list (used when questions are saved or imported). */
export async function ensureOptions(kind: OptionKind, names: unknown[]) {
  const unique = [...new Map(names.map(clean).filter(Boolean).map((n) => [keyOf(n), n])).values()];
  if (!unique.length) return;
  await ListOption.bulkWrite(
    unique.map((name) => ({
      updateOne: {
        filter: { kind, key: keyOf(name) },
        update: { $setOnInsert: { kind, name, key: keyOf(name) } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

/** The list with how many (non-archived) questions use each value, A–Z. */
export async function listOptions(kind: OptionKind): Promise<OptionJSON[]> {
  const field = OPTION_KINDS[kind].field;
  // Values already on questions (e.g. from an older import) join the list automatically.
  await ensureOptions(kind, await Question.distinct(field, { [field]: { $nin: [null, ""] } }));
  const [options, usage] = await Promise.all([
    ListOption.find({ kind }).sort({ key: 1 }).lean(),
    Question.aggregate<{ _id: string; n: number }>([
      { $match: { archived: { $ne: true }, [field]: { $nin: [null, ""] } } },
      { $group: { _id: { $toLower: `$${field}` }, n: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(usage.map((u) => [u._id, u.n]));
  return options.map((o) => ({ _id: String(o._id), name: String(o.name), count: counts.get(String(o.key)) ?? 0 }));
}

export async function createOption(kind: OptionKind, rawName: unknown) {
  const name = clean(rawName);
  if (!name) throw new HttpError("Name is required.", 400);
  if (await ListOption.exists({ kind, key: keyOf(name) })) throw new HttpError(`"${name}" already exists.`, 409);
  const doc = await ListOption.create({ kind, name, key: keyOf(name) });
  return { _id: String(doc._id), name, count: 0 };
}

/** Renames the option and every question using it. */
export async function renameOption(id: string, rawName: unknown) {
  const name = clean(rawName);
  if (!name) throw new HttpError("Name is required.", 400);
  const opt = await ListOption.findById(id);
  if (!opt) throw new HttpError("Option not found.", 404);
  const kind = opt.kind as OptionKind;
  const clash = await ListOption.findOne({ kind, key: keyOf(name), _id: { $ne: opt._id } }).lean();
  if (clash) throw new HttpError(`"${name}" already exists.`, 409);

  const field = OPTION_KINDS[kind].field;
  const old = String(opt.name);
  const { modifiedCount } = await Question.updateMany(
    { [field]: sameName(old) },
    { $set: { [field]: name } },
  );
  opt.name = name;
  opt.key = keyOf(name);
  await opt.save();
  return { _id: id, name, updated: modifiedCount };
}

/** Deletes the option and clears it from every question that used it. */
export async function deleteOption(id: string) {
  const opt = await ListOption.findById(id);
  if (!opt) throw new HttpError("Option not found.", 404);
  const field = OPTION_KINDS[opt.kind as OptionKind].field;
  const { modifiedCount } = await Question.updateMany(
    { [field]: sameName(String(opt.name)) },
    { $set: { [field]: "" } },
  );
  await opt.deleteOne();
  return { cleared: modifiedCount };
}
