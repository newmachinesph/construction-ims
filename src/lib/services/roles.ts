import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import {
  LOCKED_ROLE_KEY,
  sanitizePermissions,
  type Permission,
} from "@/lib/rbac";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { writeAudit } from "./ledger";

export interface RoleSummary {
  key: string;
  label: string;
  isSystem: boolean;
  /** ADMIN can never be edited or deleted. */
  isLocked: boolean;
  permissions: Permission[];
  userCount: number;
}

/** Every role plus how many users hold it — built-ins first, then custom by name. */
export async function listRolesWithUserCounts(): Promise<RoleSummary[]> {
  const rows = await db
    .select({
      key: roles.key,
      label: roles.label,
      isSystem: roles.isSystem,
      permissions: roles.permissions,
      userCount: sql<number>`count(${users.id})::int`,
    })
    .from(roles)
    .leftJoin(users, eq(users.role, roles.key))
    .groupBy(roles.key)
    .orderBy(desc(roles.isSystem), asc(roles.label));

  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    isSystem: r.isSystem,
    isLocked: r.key === LOCKED_ROLE_KEY,
    permissions: (r.permissions ?? []) as Permission[],
    userCount: r.userCount,
  }));
}

/** Lightweight list for assigning users to roles (key + label only). */
export async function listAssignableRoles(): Promise<{ key: string; label: string }[]> {
  return db
    .select({ key: roles.key, label: roles.label })
    .from(roles)
    .orderBy(desc(roles.isSystem), asc(roles.label));
}

export async function roleExists(key: string): Promise<boolean> {
  const rows = await db.select({ key: roles.key }).from(roles).where(eq(roles.key, key)).limit(1);
  return rows.length > 0;
}

/** Derive a stable, unique machine key from a human label. */
function keyFromLabel(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "ROLE";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`.slice(0, 40);
    if (!taken.has(candidate)) return candidate;
  }
}

export async function createRole(
  actor: SessionUser,
  input: { label: string; permissions: readonly string[] },
) {
  const label = input.label.trim();
  if (!label) throw new BusinessRuleError("A role needs a name.");
  const permissions = sanitizePermissions(input.permissions);

  const existing = await db.select({ key: roles.key }).from(roles);
  const key = keyFromLabel(label, new Set(existing.map((r) => r.key)));

  const [row] = await db
    .insert(roles)
    .values({ key, label, isSystem: false, permissions })
    .returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ROLE_CREATE",
    entity: "role",
    entityId: key,
    after: { label, permissions },
  });

  return row;
}

export async function updateRole(
  actor: SessionUser,
  key: string,
  input: { label?: string; permissions?: readonly string[] },
) {
  const role = await db.query.roles.findFirst({ where: eq(roles.key, key) });
  if (!role) throw new NotFoundError("Role");
  if (role.key === LOCKED_ROLE_KEY) {
    throw new ForbiddenError("The Administrator role is locked and always keeps full access.");
  }

  const patch: { label?: string; permissions?: Permission[]; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) throw new BusinessRuleError("A role needs a name.");
    patch.label = label;
  }
  if (input.permissions !== undefined) {
    patch.permissions = sanitizePermissions(input.permissions);
  }

  const [row] = await db.update(roles).set(patch).where(eq(roles.key, key)).returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ROLE_UPDATE",
    entity: "role",
    entityId: key,
    before: { label: role.label, permissions: role.permissions },
    after: { label: row.label, permissions: row.permissions },
  });

  return row;
}

export async function deleteRole(actor: SessionUser, key: string) {
  const role = await db.query.roles.findFirst({ where: eq(roles.key, key) });
  if (!role) throw new NotFoundError("Role");
  if (role.isSystem) throw new ForbiddenError("Built-in roles cannot be deleted.");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, key));
  if (count > 0) {
    throw new ConflictError(
      `Cannot delete a role still assigned to ${count} user${count === 1 ? "" : "s"}. Reassign them first.`,
    );
  }

  await db.delete(roles).where(eq(roles.key, key));

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ROLE_DELETE",
    entity: "role",
    entityId: key,
    before: { label: role.label, permissions: role.permissions },
  });
}
