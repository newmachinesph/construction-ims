import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, warehouses } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/dal";
import { outputVatRate } from "@/lib/services/sales";
import { uomLabelMap } from "@/lib/services/uom";
import { PageHeader } from "@/components/ui/PageHeader";
import { PosTerminal } from "./PosTerminal";

export default async function PosPage() {
  await requirePermissionPage("sale:create");

  // The rate the server will actually charge — the register displays the same one,
  // so the cashier never sees a total that differs from what gets posted.
  const vatRate = await outputVatRate();

  const [warehouseRows, customerRows, uomLabels] = await Promise.all([
    db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(asc(warehouses.name)),
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.isActive, true))
      .orderBy(asc(customers.name)),
    uomLabelMap(),
  ]);

  return (
    <>
      <PageHeader
        title="Point of sale"
        description="Ring up a counter sale. Stock leaves the warehouse and a BIR sales invoice is issued."
      />
      {warehouseRows.length === 0 ? (
        <p className="text-sm text-muted">Create a warehouse first — there is nothing to sell from.</p>
      ) : (
        <PosTerminal
          warehouses={warehouseRows}
          customers={customerRows}
          vatRate={vatRate}
          uomLabels={uomLabels}
        />
      )}
    </>
  );
}
