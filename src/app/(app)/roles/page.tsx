import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listRolesWithUserCounts } from "@/lib/services/roles";
import { PageHeader } from "@/components/ui/PageHeader";
import { RolesManager } from "./RolesManager";

export default async function RolesPage() {
  await requirePermissionPage("role:read");
  const canWrite = await can("role:write");
  const roles = await listRolesWithUserCounts();

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Define what each role can do. Built-in roles can be retuned; create custom roles for your team."
      />
      <RolesManager initialRoles={roles} canWrite={canWrite} />
    </>
  );
}
