import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listAssignableRoles } from "@/lib/services/roles";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewUserForm } from "./NewUserForm";
import { UsersTable } from "./UsersTable";

export default async function UsersPage() {
  await requirePermissionPage("user:read");
  const canWrite = await can("user:write");

  const [rows, roles] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(asc(users.fullName)),
    listAssignableRoles(),
  ]);

  return (
    <>
      <PageHeader title="Users" description="Accounts, roles, and access for this workspace." />
      {canWrite ? <NewUserForm roles={roles} /> : null}
      <UsersTable rows={rows} roles={roles} canWrite={canWrite} />
    </>
  );
}
