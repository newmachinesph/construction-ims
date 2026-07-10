import Link from "next/link";
import { listPurchaseOrders } from "@/lib/services/procurement";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PurchaseOrdersTable } from "./PurchaseOrdersTable";

export default async function PurchaseOrdersPage() {
  await requirePermissionPage("po:read");
  const [pos, canCreate] = await Promise.all([listPurchaseOrders(), can("po:create")]);

  return (
    <>
      <PageHeader title="Purchase orders" description="Draft, approve and track supplier purchase orders.">
        {canCreate ? (
          <Link href="/purchase-orders/new">
            <Button>New PO</Button>
          </Link>
        ) : null}
      </PageHeader>

      <PurchaseOrdersTable pos={pos} />
    </>
  );
}
