// Start fresh: backs up every collection to backups/<db>-<timestamp>.json, then deletes all
// questions and attempt history. Settings are kept. Dry run unless --yes is passed.
//   npm run reset-db            → show what would be deleted
//   npm run reset-db -- --yes   → back up, then delete
import { mkdir, readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";

const WIPE = ["questions", "activityevents", "daylogs"];
const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error("MONGODB_URI missing from .env.local");

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const names = (await db.listCollections().toArray()).map((c) => c.name);
const counts = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await db.collection(n).countDocuments()])));
console.log(`database "${db.databaseName}":`, counts);

if (!process.argv.includes("--yes")) {
  console.log(`\nDry run. Would back up everything, then delete: ${WIPE.filter((n) => names.includes(n)).join(", ") || "nothing"}.`);
  console.log("Run again with --yes to do it.");
} else {
  const dump = {};
  for (const n of names) dump[n] = await db.collection(n).find({}).toArray();
  await mkdir(new URL("../backups/", import.meta.url), { recursive: true });
  const file = new URL(`../backups/${db.databaseName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
  await writeFile(file, JSON.stringify(dump, null, 2));
  console.log(`backup written: ${file.pathname}`);
  for (const n of WIPE) if (names.includes(n)) await db.collection(n).drop();
  console.log(`deleted: ${WIPE.filter((n) => names.includes(n)).join(", ")}`);
}
await mongoose.disconnect();
