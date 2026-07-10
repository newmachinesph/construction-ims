import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, warehouses } from "@/db/schema";
import { listAdjustments } from "@/lib/services/stock";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdjustmentsTable } from "./AdjustmentsTable";
import { NewAdjustmentForm } from "./NewAdjustmentForm";

export default async function AdjustmentsPage() {
  await requirePermissionPage("adjustment:read");
  const [adjustmentRows, canApprove, canCreate] = await Promise.all([
    listAdjustments(),
    can("adjustment:approve"),
    can("adjustment:create"),
  ]);

  const [warehouseRows, itemRows] = canCreate
    ? await Promise.all([
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
      ])
    : [[], []];

  return (
    <>
      <PageHeader title="Stock adjustments" description="Count variances, damage, pilferage and corrections." />

      {canCreate ? <NewAdjustmentForm warehouses={warehouseRows} items={itemRows} /> : null}

      <AdjustmentsTable adjustments={adjustmentRows} canApprove={canApprove} />
    </>
  );
}
