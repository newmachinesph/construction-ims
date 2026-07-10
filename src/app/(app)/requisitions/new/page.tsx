import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, projects, warehouses } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewMrForm } from "./NewMrForm";

export default async function NewRequisitionPage() {
  await requirePermissionPage("mr:create");

  const [projectRows, warehouseRows, itemRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name)),
    db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(asc(warehouses.name)),
    db
      .select({ id: items.id, sku: items.sku, name: items.name, uom: items.uom })
      .from(items)
      .where(eq(items.isActive, true))
      .orderBy(asc(items.name)),
  ]);

  return (
    <>
      <PageHeader title="New material requisition" description="Request materials for a project against a warehouse." />
      <NewMrForm projects={projectRows} warehouses={warehouseRows} items={itemRows} />
    </>
  );
}
