import Link from "next/link";
import { Upload } from "lucide-react";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listStock } from "@/lib/services/stock";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StockTable } from "./StockTable";

export default async function StockPage() {
  await requirePermissionPage("stock:read");
  const [canCost, canImport, rows] = await Promise.all([
    can("report:cost"),
    can("adjustment:create"),
    listStock(),
  ]);

  return (
    <>
      <PageHeader
        title="Stock on hand"
        description="Live inventory across the main warehouse and every site bodega."
      >
        {canImport ? (
          <Link href="/stock/import">
            <Button variant="secondary" size="sm">
              <Upload className="size-4" /> Import stock
            </Button>
          </Link>
        ) : null}
      </PageHeader>
      <StockTable rows={rows} canCost={canCost} />
    </>
  );
}
