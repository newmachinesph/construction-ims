import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listStock } from "@/lib/services/stock";
import { PageHeader } from "@/components/ui/PageHeader";
import { StockTable } from "./StockTable";

export default async function StockPage() {
  await requirePermissionPage("stock:read");
  const canCost = await can("report:cost");
  const rows = await listStock();

  return (
    <>
      <PageHeader
        title="Stock on hand"
        description="Live inventory across the main warehouse and every site bodega."
      />
      <StockTable rows={rows} canCost={canCost} />
    </>
  );
}
