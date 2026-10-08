/**
 * Role-based access control. A user's role is stored on their account (`user.role` in the
 * database, changed on the Users page); what each role may do is defined here, in one place, and
 * checked on the server by `route({ permission })` / `requirePermission`, and in the UI by `useCan`.
 *
 * Every signed-in user can see the catalog, set their timezone and suggest catalog changes; those need
 * no permission. Practising (progress, review, notes, music…) is a permission so admins can be
 * management-only.
 */

export const PERMISSIONS = {
  "practice.track":
    "Practise: Desk, Review, Progress; log attempts, star, notes, hide; interview date, revision ladder, music",
  "catalog.edit": "Add, import, look up, edit and retire catalog questions; fill company tags",
  "catalog.delete": "Delete catalog questions",
  "lists.manage": "Add, rename and delete platforms and patterns",
  "submissions.review": "See everyone's suggestions; approve or reject them",
  "users.manage": "See all users and change their roles",
  "announcements.manage": "Post, schedule, edit and end announcements on everyone's Desk",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES = ["user", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { label: string; description: string; permissions: readonly Permission[] }> = {
  user: {
    label: "User",
    description: "Tracks their own progress; suggests new questions and edits.",
    permissions: ["practice.track"],
  },
  editor: {
    label: "Editor",
    description: "Practises like a user, and also curates the catalog and reviews suggestions. Can't delete questions or manage users.",
    permissions: ["practice.track", "catalog.edit", "lists.manage", "submissions.review"],
  },
  admin: {
    label: "Admin",
    description: "Runs the app: catalog, lists, reviews, deleting questions, roles and announcements. No personal practice.",
    permissions: ["catalog.edit", "catalog.delete", "lists.manage", "submissions.review", "users.manage", "announcements.manage"],
  },
};

/** A stored role, defaulting to `user` for anything unknown. */
export function parseRole(raw: unknown): Role {
  return ROLES.find((r) => r === raw) ?? "user";
}

export function permissionsOf(role: Role): Permission[] {
  return [...ROLE_INFO[role].permissions];
}
