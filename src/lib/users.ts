import mongoose from "mongoose";
import { HttpError } from "./attempts";
import { parseRole, permissionsOf, ROLES, type Role } from "./rbac";

/** Accounts live in Better Auth's `user` / `account` collections; this reads and updates them directly. */
const users = () => mongoose.connection.db!.collection("user");
const accounts = () => mongoose.connection.db!.collection("account");

function objectId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError("User not found", 404);
  return new mongoose.Types.ObjectId(id);
}

/** The user's current role from the database (not the session cookie, which may be minutes old). */
export async function roleOf(userId: string): Promise<Role> {
  const doc = await users().findOne({ _id: objectId(userId) }, { projection: { role: 1 } });
  return parseRole(doc?.role);
}

export type UserJSON = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** How they sign in: "credential" (email + password), "github", "google". */
  providers: string[];
  createdAt: string | null;
};

export async function listUsers(): Promise<UserJSON[]> {
  const [docs, links] = await Promise.all([
    users().find({}, { projection: { name: 1, email: 1, role: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray(),
    accounts().find({}, { projection: { userId: 1, providerId: 1 } }).toArray(),
  ]);
  const providers = new Map<string, string[]>();
  for (const a of links) {
    const key = String(a.userId);
    providers.set(key, [...(providers.get(key) ?? []), String(a.providerId)]);
  }
  return docs.map((d) => ({
    id: String(d._id),
    name: String(d.name ?? ""),
    email: String(d.email ?? ""),
    role: parseRole(d.role),
    providers: providers.get(String(d._id)) ?? [],
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
  }));
}

/** Changes a user's role. The last admin can't be demoted, so the app is never left without one. */
export async function setRole(userId: string, raw: unknown) {
  const role = ROLES.find((r) => r === raw);
  if (!role) throw new HttpError(`Role must be one of: ${ROLES.join(", ")}.`, 400);
  const _id = objectId(userId);
  const current = await users().findOne({ _id }, { projection: { role: 1 } });
  if (!current) throw new HttpError("User not found", 404);
  if (parseRole(current.role) === "admin" && role !== "admin") {
    const admins = await users().countDocuments({ role: "admin" });
    if (admins <= 1) throw new HttpError("This is the only admin. Make someone else admin first.", 409);
  }
  await users().updateOne({ _id }, { $set: { role, updatedAt: new Date() } });
  return role;
}

/** Accounts whose role practises (users and editors; a missing role counts as user). */
export async function countLearners() {
  const roles = ROLES.filter((r) => permissionsOf(r).includes("practice.track"));
  return users().countDocuments({ $or: [{ role: { $in: roles } }, { role: { $exists: false } }] });
}

/** Account counts for the admin dashboard. `since` marks "new". Active = signed in or practised since then. */
export async function userOverview(since: Date) {
  const db = mongoose.connection.db!;
  const [total, fresh, sessionUsers, eventUsers, recent] = await Promise.all([
    users().countDocuments(),
    users().countDocuments({ createdAt: { $gte: since } }),
    db.collection("session").distinct("userId", { updatedAt: { $gte: since } }),
    db.collection("activityevents").distinct("userId", { at: { $gte: since } }),
    users().find({}, { projection: { name: 1, email: 1, role: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(5).toArray(),
  ]);
  const active = new Set([...sessionUsers, ...eventUsers].map(String));
  return {
    total,
    newSince: fresh,
    activeSince: active.size,
    recent: recent.map((u) => ({
      id: String(u._id),
      name: String(u.name ?? ""),
      email: String(u.email ?? ""),
      role: parseRole(u.role),
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    })),
  };
}
