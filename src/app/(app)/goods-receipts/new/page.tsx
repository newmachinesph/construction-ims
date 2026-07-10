import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewGrnForm } from "./NewGrnForm";

export default async function NewGoodsReceiptPage() {
  await requirePermissionPage("grn:create");

  const pos = await db.query.purchaseOrders.findMany({
    where: inArray(purchaseOrders.status, ["APPROVED", "PARTIALLY_RECEIVED"]),
    with: { supplier: true, warehouse: true, lines: { with: { item: true } } },
  });

  return (
    <>
      <PageHeader title="Receive against PO" description="Post a goods receipt against an approved purchase order." />
      <NewGrnForm pos={pos} />
    </>
  );
}
