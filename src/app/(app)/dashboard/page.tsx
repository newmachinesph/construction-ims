import { count, eq, inArray } from "drizzle-orm";
import { Boxes, FileWarning, PackageCheck, ShoppingCart } from "lucide-react";
import { db } from "@/db";
import { items, materialRequisitions, purchaseOrders } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { lowStockItems, recentMovements, listStock } from "@/lib/services/stock";
import { formatManila, formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export default async function DashboardPage() {
  await requirePermissionPage("stock:read");
  const canCost = await can("report:cost");

  const [stock, lowStock, movements, activeSkuRows, openPoRows, pendingMrRows] = await Promise.all([
    listStock(),
    lowStockItems(),
    recentMovements(12),
    db.select({ n: count() }).from(items).where(eq(items.isActive, true)),
    db
      .select({ n: count() })
      .from(purchaseOrders)
      .where(inArray(purchaseOrders.status, ["APPROVED", "PARTIALLY_RECEIVED"])),
    db.select({ n: count() }).from(materialRequisitions).where(eq(materialRequisitions.status, "SUBMITTED")),
  ]);

  const inventoryValue = stock.reduce(
    (sum, row) => sum + Number(row.qtyOnHand) * Number(row.avgUnitCost),
    0,
  );
  const activeSkus = Number(activeSkuRows[0]?.n ?? 0);
  const openPos = Number(openPoRows[0]?.n ?? 0);
  const pendingMrs = Number(pendingMrRows[0]?.n ?? 0);

  return (
    <>
      <PageHeader title="Dashboard" description="Live picture of stock, procurement and site demand." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active SKUs" value={activeSkus} icon={<Boxes className="size-5" />} />
        {canCost ? (
          <StatTile label="Inventory value" value={formatPHP(inventoryValue)} hint="On-hand × avg cost" />
        ) : null}
        <StatTile
          label="Low-stock items"
          value={lowStock.length}
          alert={lowStock.length > 0}
          icon={<FileWarning className="size-5" />}
        />
        <StatTile
          label="Open purchase orders"
          value={openPos}
          hint="Approved / partially received"
          icon={<ShoppingCart className="size-5" />}
        />
        <StatTile
          label="Pending requisitions"
          value={pendingMrs}
          hint="Awaiting approval"
          icon={<PackageCheck className="size-5" />}
        />
      </div>

      {/* Low stock — reorder */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Low stock — reorder</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>SKU</Th>
              <Th>Item</Th>
              <Th numeric>On hand</Th>
              <Th numeric>Reorder point</Th>
              <Th numeric>Suggested qty</Th>
            </THead>
            <TBody>
              {lowStock.length === 0 ? (
                <EmptyRow colSpan={5}>Every item is above its reorder point.</EmptyRow>
              ) : (
                lowStock.map((row) => (
                  <Tr key={row.itemId}>
                    <Td className="tabular text-ink-soft">{row.sku}</Td>
                    <Td>
                      <span className="text-ink">{row.name}</span>
                      {row.isWeatherSensitive ? (
                        <span
                          title="Weather-sensitive — extra buffer during rainy season"
                          className="ml-2 inline-flex items-center rounded border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-muted"
                        >
                          WX
                        </span>
                      ) : null}
                    </Td>
                    <Td numeric className="text-alert">
                      {formatQty(row.totalOnHand)} {uomLabel(row.uom)}
                    </Td>
                    <Td numeric muted>
                      {formatQty(row.reorderPoint)}
                    </Td>
                    <Td numeric muted>
                      {formatQty(row.reorderQty)}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      {/* Recent movements */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent stock movements</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Item</Th>
              <Th>Warehouse</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Balance</Th>
              <Th>Reference</Th>
            </THead>
            <TBody>
              {movements.length === 0 ? (
                <EmptyRow colSpan={7}>No movements recorded yet.</EmptyRow>
              ) : (
                movements.map((m) => {
                  const q = Number(m.quantity);
                  return (
                    <Tr key={m.id}>
                      <Td muted className="whitespace-nowrap text-xs">{formatManila(m.createdAt)}</Td>
                      <Td>
                        <StatusBadge value={m.type} tone="outline" />
                      </Td>
                      <Td>
                        <span className="text-ink">{m.itemName}</span>{" "}
                        <span className="tabular text-xs text-muted">{m.sku}</span>
                      </Td>
                      <Td muted>{m.warehouseName}</Td>
                      <Td numeric className={q < 0 ? "text-ink-soft" : "text-ink"}>
                        {q > 0 ? "+" : ""}
                        {formatQty(q)} {uomLabel(m.uom)}
                      </Td>
                      <Td numeric muted>{formatQty(m.balanceAfter)}</Td>
                      <Td muted className="tabular text-xs">{m.refNumber ?? "—"}</Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>
    </>
  );
}
