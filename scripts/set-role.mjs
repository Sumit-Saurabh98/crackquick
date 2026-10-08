// Sets a user's role from the command line. Needed once, to make the first admin (after that,
// admins change roles on the Users page). The account must exist: sign up first.
//   npm run set-role -- you@example.com admin      (roles: user, editor, admin)
//   npm run set-role                               → lists accounts and their roles
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";

const ROLES = ["user", "editor", "admin"];
const [email, role] = process.argv.slice(2);

const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
if (!uri) throw new Error("MONGODB_URI missing from .env.local");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const users = mongoose.connection.db.collection("user");

if (!email) {
  for (const u of await users.find({}, { projection: { email: 1, role: 1 } }).sort({ createdAt: 1 }).toArray()) {
    console.log(`${(u.role ?? "user").padEnd(7)} ${u.email}`);
  }
} else {
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(", ")}`);
  const r = await users.updateOne({ email: email.trim().toLowerCase() }, { $set: { role, updatedAt: new Date() } });
  if (!r.matchedCount) throw new Error(`No account for ${email}. Sign up first, then run this again.`);
  console.log(`${email} is now ${role}.`);
}
await mongoose.disconnect();
