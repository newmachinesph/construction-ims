import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession, type SessionUser } from "./session";
import { hasPermission, type Permission } from "@/lib/rbac";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

/**
 * Data Access Layer. Every server component, server action and route handler
 * calls one of these — never `readSession()` directly, and never trusts a
 * role passed in from the client.
 *
 * `cache()` dedupes the session lookup across a single request's render tree.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => readSession());

/** For route handlers: throws, so the API wrapper turns it into a 401/403. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

/** For pages/layouts: redirects instead of throwing. */
export async function requireUserPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermissionPage(permission: Permission): Promise<SessionUser> {
  const user = await requireUserPage();
  if (!hasPermission(user.permissions, permission)) redirect("/forbidden");
  return user;
}

/** Convenience for conditional rendering. Never the only gate on a mutation. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? hasPermission(user.permissions, permission) : false;
}
