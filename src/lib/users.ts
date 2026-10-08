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

/** The user's current role and suspension from the database (not the session cookie, which may be minutes old). */
export async function accountState(userId: string): Promise<{ role: Role; suspended: boolean }> {
  const doc = await users().findOne({ _id: objectId(userId) }, { projection: { role: 1, suspended: 1 } });
  return { role: parseRole(doc?.role), suspended: Boolean(doc?.suspended) };
}

/** Ids of suspended accounts (their pending suggestions are kept out of the review queue). */
export async function suspendedUserIds(): Promise<string[]> {
  return (await users().find({ suspended: true }, { projection: { _id: 1 } }).toArray()).map((u) => String(u._id));
}

/** Admins who can still act; the app must always keep at least one. */
function activeAdmins() {
  return users().countDocuments({ role: "admin", suspended: { $ne: true } });
}

export type UserJSON = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** How they sign in: "credential" (email + password), "github", "google". */
  providers: string[];
  createdAt: string | null;
  suspended: boolean;
  suspendedReason: string;
  suspendedAt: string | null;
};

export async function listUsers(): Promise<UserJSON[]> {
  const [docs, links] = await Promise.all([
    users()
      .find({}, { projection: { name: 1, email: 1, role: 1, createdAt: 1, suspended: 1, suspendedReason: 1, suspendedAt: 1 } })
      .sort({ createdAt: 1 })
      .toArray(),
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
    suspended: Boolean(d.suspended),
    suspendedReason: String(d.suspendedReason ?? ""),
    suspendedAt: d.suspendedAt ? new Date(d.suspendedAt).toISOString() : null,
  }));
}

/** Changes a user's role. The last admin can't be demoted, so the app is never left without one. */
export async function setRole(userId: string, raw: unknown) {
  const role = ROLES.find((r) => r === raw);
  if (!role) throw new HttpError(`Role must be one of: ${ROLES.join(", ")}.`, 400);
  const _id = objectId(userId);
  const current = await users().findOne({ _id }, { projection: { role: 1, suspended: 1 } });
  if (!current) throw new HttpError("User not found", 404);
  if (parseRole(current.role) === "admin" && role !== "admin" && !current.suspended && (await activeAdmins()) <= 1) {
    throw new HttpError("This is the only admin. Make someone else admin first.", 409);
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

/**
 * Suspends (or restores) an account. Suspended: no new sign-ins, current sessions ended, every API
 * call refused, pending suggestions hidden from reviewers. Data is kept; undo restores everything.
 */
export async function setSuspended(byUserId: string, userId: string, suspended: boolean, reason: unknown) {
  const _id = objectId(userId);
  const target = await users().findOne({ _id }, { projection: { role: 1, suspended: 1 } });
  if (!target) throw new HttpError("User not found", 404);
  if (suspended) {
    if (userId === byUserId) throw new HttpError("You can't suspend yourself.", 400);
    if (parseRole(target.role) === "admin" && !target.suspended && (await activeAdmins()) <= 1) {
      throw new HttpError("This is the only active admin.", 409);
    }
    await users().updateOne(
      { _id },
      {
        $set: {
          suspended: true,
          suspendedReason: String(reason ?? "").trim().slice(0, 500),
          suspendedAt: new Date(),
          suspendedBy: byUserId,
          updatedAt: new Date(),
        },
      },
    );
    // Sign them out everywhere now, not when their session would expire.
    await mongoose.connection.db!.collection("session").deleteMany({ userId: _id });
  } else {
    await users().updateOne(
      { _id },
      { $set: { suspended: false, updatedAt: new Date() }, $unset: { suspendedReason: "", suspendedAt: "", suspendedBy: "" } },
    );
  }
  return suspended;
}
