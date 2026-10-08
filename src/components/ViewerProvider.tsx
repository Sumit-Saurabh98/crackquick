"use client";

import { createContext, useContext } from "react";
import type { Permission, Role } from "@/lib/rbac";

/** The signed-in user as client components see it. */
export type ClientViewer = { id: string; name: string; email: string; role: Role; permissions: Permission[] };

const ViewerContext = createContext<ClientViewer | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: ClientViewer | null; children: React.ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

/** The signed-in user; null only on the sign-in page. */
export function useViewer() {
  return useContext(ViewerContext);
}

/** Whether the signed-in user's role grants `permission`. Only hides UI; the server enforces it. */
export function useCan(permission: Permission) {
  return useContext(ViewerContext)?.permissions.includes(permission) ?? false;
}
