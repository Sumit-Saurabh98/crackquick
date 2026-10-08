/**
 * Role-based access control. A user's role is stored on their account (`user.role` in the
 * database, changed on the Users page); what each role may do is defined here, in one place, and
 * checked on the server by `route({ permission })` / `requirePermission`, and in the UI by `useCan`.
 *
 * Every signed-in user can always work on their own data (progress, notes, attempts, settings,
 * playlists) and suggest catalog changes; those need no permission.
 */

export const PERMISSIONS = {
  "catalog.edit": "Add, import, look up, edit and retire catalog questions; fill company tags",
  "catalog.delete": "Delete catalog questions",
  "lists.manage": "Add, rename and delete platforms and patterns",
  "submissions.review": "See everyone's suggestions; approve or reject them",
  "users.manage": "See all users and change their roles",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES = ["user", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { label: string; description: string; permissions: readonly Permission[] }> = {
  user: {
    label: "User",
    description: "Tracks their own progress; suggests new questions and edits.",
    permissions: [],
  },
  editor: {
    label: "Editor",
    description: "Curates the catalog and reviews suggestions. Can't delete questions or manage users.",
    permissions: ["catalog.edit", "lists.manage", "submissions.review"],
  },
  admin: {
    label: "Admin",
    description: "Everything, including deleting questions and changing roles.",
    permissions: Object.keys(PERMISSIONS) as Permission[],
  },
};

/** A stored role, defaulting to `user` for anything unknown. */
export function parseRole(raw: unknown): Role {
  return ROLES.find((r) => r === raw) ?? "user";
}

export function permissionsOf(role: Role): Permission[] {
  return [...ROLE_INFO[role].permissions];
}
