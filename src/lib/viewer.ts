import { NextRequest } from "next/server";
import { HttpError } from "./attempts";
import { auth } from "./auth";
import { fail } from "./http";
import { dbConnect } from "./mongodb";
import { permissionsOf, type Permission, type Role } from "./rbac";
import { runWithTimezone } from "./requestContext";
import { accountState } from "./users";
import { getSettings, type SettingsDoc } from "@/models/Settings";

/** The signed-in user making a request, with their role's permissions and their settings. */
export type Viewer = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  /** Suspended accounts can't use the API (route() refuses them). */
  suspended: boolean;
  settings: SettingsDoc;
};

/** The signed-in user, or null. Connects to the database. */
export async function getViewer(headers: Headers): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  await dbConnect();
  const { user } = session;
  const [{ role, suspended }, settings] = await Promise.all([accountState(user.id), getSettings(user.id)]);
  return { id: user.id, name: user.name, email: user.email, role, permissions: permissionsOf(role), suspended, settings };
}

export function can(viewer: Viewer, permission: Permission) {
  return viewer.permissions.includes(permission);
}

export function requirePermission(viewer: Viewer, permission: Permission) {
  if (!can(viewer, permission)) throw new HttpError("You don't have permission to do that.", 403);
}

/** Management roles: anyone who can change the catalog, review suggestions or manage users. */
export const MANAGEMENT: Permission[] = ["catalog.edit", "submissions.review", "users.manage", "announcements.manage"];

export function requireAnyPermission(viewer: Viewer, permissions: Permission[]) {
  if (!permissions.some((p) => can(viewer, p))) throw new HttpError("You don't have permission to do that.", 403);
}

type Params = Record<string, string | string[]>;
type Handler<P extends Params> = (req: NextRequest, ctx: { viewer: Viewer; params: P }) => Promise<Response>;

/**
 * Wraps an API route: requires a signed-in user (with `permission`, one whose role grants it), runs the handler
 * in that user's timezone, and turns thrown errors into `{ error }` responses with `errorStatus`
 * as the fallback status.
 */
export function route<P extends Params = Params>(
  handler: Handler<P>,
  opts: { permission?: Permission; errorStatus?: number } = {},
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const viewer = await getViewer(req.headers);
      if (!viewer) throw new HttpError("Sign in required.", 401);
      if (viewer.suspended) throw new HttpError("Your account is suspended.", 403);
      if (opts.permission) requirePermission(viewer, opts.permission);
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await runWithTimezone(viewer.settings.timezone, () => handler(req, { viewer, params }));
    } catch (e) {
      return fail(e, opts.errorStatus ?? 500);
    }
  };
}
