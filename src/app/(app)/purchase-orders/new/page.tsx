import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, projects, suppliers, warehouses } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewPoForm } from "./NewPoForm";

export default async function NewPurchaseOrderPage() {
  await requirePermissionPage("po:create");

  const [supplierRows, warehouseRows, projectRows, itemRows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(asc(suppliers.name)),
    db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(asc(warehouses.name)),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name)),
    db
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        uom: items.uom,
        vatClass: items.vatClass,
        standardCost: items.standardCost,
      })
      .from(items)
      .where(eq(items.isActive, true))
      .orderBy(asc(items.name)),
  ]);

  return (
    <>
      <PageHeader title="New purchase order" description="Draft a PO against a supplier and warehouse." />
      <NewPoForm suppliers={supplierRows} warehouses={warehouseRows} projects={projectRows} items={itemRows} />
    </>
  );
}
