// One-time move from the single-user layout to accounts. Each question's personal fields (status,
// schedule, notes, star, archived, …) become the owner's progress, and all attempts and settings
// (timezone, interview date, playlists) become theirs. The catalog keeps the shared fields.
// Backs up every collection to backups/ first. Dry run unless --yes is passed. Safe to re-run.
//   npm run migrate-accounts -- --owner you@example.com          → show what would change
//   npm run migrate-accounts -- --owner you@example.com --yes    → back up, then migrate
// The owner's account is created if it doesn't exist yet (email marked verified, no password), so
// signing in with GitHub / Google using that same email lands in it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";

const PERSONAL = [
  "status",
  "timesSolved",
  "lapses",
  "lastSolvedAt",
  "nextRevisionAt",
  "revisionStage",
  "confidence",
  "timeSpentMinutes",
  "totalMinutes",
  "notes",
  "isStarred",
  "archived",
];

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const owner = arg("--owner")?.trim().toLowerCase();
if (!owner || !owner.includes("@")) throw new Error("Pass the account that owns the existing data: --owner you@example.com");
const apply = process.argv.includes("--yes");

const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error("MONGODB_URI missing from .env.local");

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const names = (await db.listCollections().toArray()).map((c) => c.name);
const col = (n) => db.collection(n);

const legacyQuestions = await col("questions").countDocuments({ status: { $exists: true } });
const looseEvents = await col("activityevents").countDocuments({ userId: { $exists: false } });
const mainSettings = await col("settings").findOne({ key: "main" });
const existingUser = await col("user").findOne({ email: owner });

console.log(`database "${db.databaseName}", owner ${owner}${existingUser ? " (account exists)" : " (account will be created)"}`);
console.log(`- questions with personal fields to move: ${legacyQuestions}`);
console.log(`- attempts without an owner: ${looseEvents}`);
console.log(`- single-user settings to move: ${mainSettings ? "yes" : "none"}`);

if (!apply) {
  console.log("\nDry run. Run again with --yes to back up and migrate.");
  await mongoose.disconnect();
  process.exit(0);
}

const dump = {};
for (const n of names) dump[n] = await col(n).find({}).toArray();
await mkdir(new URL("../backups/", import.meta.url), { recursive: true });
const file = new URL(`../backups/${db.databaseName}-before-accounts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(file, JSON.stringify(dump, null, 2));
console.log(`\nbackup written: ${file.pathname}`);

let user = existingUser;
if (!user) {
  const now = new Date();
  const doc = { name: owner.split("@")[0], email: owner, emailVerified: true, image: null, role: "user", createdAt: now, updatedAt: now };
  const { insertedId } = await col("user").insertOne(doc);
  user = { ...doc, _id: insertedId };
  console.log(`created account ${owner}`);
}
const userId = String(user._id);

// Questions → owner's progress + catalog
const docs = await col("questions").find({ status: { $exists: true } }).toArray();
for (const q of docs) {
  const personal = Object.fromEntries(PERSONAL.filter((k) => q[k] !== undefined).map((k) => [k, q[k]]));
  const now = new Date();
  await col("progress").updateOne(
    { userId, questionId: q._id },
    { $set: { ...personal, updatedAt: now }, $setOnInsert: { userId, questionId: q._id, createdAt: q.createdAt ?? now } },
    { upsert: true },
  );
}
if (docs.length) {
  await col("questions").updateMany(
    { _id: { $in: docs.map((q) => q._id) } },
    { $unset: Object.fromEntries(PERSONAL.map((k) => [k, ""])) },
  );
}
await col("questions").updateMany({ retired: { $exists: false } }, { $set: { retired: false } });
console.log(`moved personal fields of ${docs.length} questions`);

const ev = await col("activityevents").updateMany({ userId: { $exists: false } }, { $set: { userId } });
console.log(`assigned ${ev.modifiedCount} attempts`);

if (mainSettings) {
  // A settings document made by signing in before migrating holds only defaults; the old one wins.
  await col("settings").deleteMany({ userId, _id: { $ne: mainSettings._id } });
  await col("settings").updateOne({ _id: mainSettings._id }, { $set: { userId }, $unset: { key: "", dailyNewGoal: "", targetList: "" } });
  console.log("moved settings and playlists");
}

// Indexes from the single-user layout. The app creates the new ones on start.
const drop = { settings: ["key_1"], questions: ["archived_1_status_1_nextRevisionAt_1", "lastSolvedAt_1"], activityevents: ["at_1", "questionId_1_at_-1"] };
for (const [n, indexes] of Object.entries(drop)) {
  if (!names.includes(n)) continue;
  const have = (await col(n).indexes()).map((i) => i.name);
  for (const i of indexes) if (have.includes(i)) await col(n).dropIndex(i);
}

console.log("\ndone.");
await mongoose.disconnect();
