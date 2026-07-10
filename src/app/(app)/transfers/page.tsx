import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, warehouses } from "@/db/schema";
import { listTransfers } from "@/lib/services/stock";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransfersTable } from "./TransfersTable";
import { NewTransferForm } from "./NewTransferForm";

export default async function TransfersPage() {
  await requirePermissionPage("transfer:read");
  const [transferRows, canReceive, canCreate] = await Promise.all([
    listTransfers(),
    can("transfer:receive"),
    can("transfer:create"),
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
      <PageHeader title="Stock transfers" description="Move materials between the main warehouse and site bodegas." />

      {canCreate ? <NewTransferForm warehouses={warehouseRows} items={itemRows} /> : null}

      <TransfersTable transfers={transferRows} canReceive={canReceive} />
    </>
  );
}
