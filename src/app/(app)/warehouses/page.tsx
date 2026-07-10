import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { warehouses, projects } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { WarehouseForm } from "./WarehouseForm";
import { WarehousesTable } from "./WarehousesTable";

export default async function WarehousesPage() {
  await requirePermissionPage("warehouse:read");
  const canWrite = await can("warehouse:write");

  const [rows, projectRows] = await Promise.all([
    db
      .select({
        id: warehouses.id,
        code: warehouses.code,
        name: warehouses.name,
        kind: warehouses.kind,
        projectId: warehouses.projectId,
        address: warehouses.address,
        isActive: warehouses.isActive,
        projectName: projects.name,
      })
      .from(warehouses)
      .leftJoin(projects, eq(projects.id, warehouses.projectId))
      .orderBy(asc(warehouses.name)),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name)),
  ]);

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Main warehouse and site bodegas where stock physically lives."
      />
      {canWrite ? <WarehouseForm projects={projectRows} /> : null}
      <WarehousesTable rows={rows} projects={projectRows} canWrite={canWrite} />
    </>
  );
}
