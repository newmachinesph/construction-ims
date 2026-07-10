import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listStock, lowStockItems, recentMovements } from "@/lib/services/stock";
import { formatManila, formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { PrintButton } from "./PrintButton";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

interface CategoryValuation {
  id: string;
  name: string;
  itemCount: number;
  totalValue: number;
}

export default async function ReportsPage() {
  await requirePermissionPage("report:read");
  const canCost = await can("report:cost");

  const [lowStock, movements] = await Promise.all([lowStockItems(), recentMovements(100)]);

  let valuation: CategoryValuation[] = [];
  if (canCost) {
    const [stockRows, categoryRows] = await Promise.all([
      listStock(),
      db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    ]);

    const byCategory = new Map<string, { items: Set<string>; value: number }>();
    for (const row of stockRows) {
      const entry = byCategory.get(row.categoryId) ?? { items: new Set<string>(), value: 0 };
      entry.items.add(row.itemId);
      entry.value += Number(row.qtyOnHand) * Number(row.avgUnitCost);
      byCategory.set(row.categoryId, entry);
    }
    const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));

    valuation = [...byCategory.entries()]
      .map(([categoryId, entry]) => ({
        id: categoryId,
        name: categoryNameById.get(categoryId) ?? "Uncategorized",
        itemCount: entry.items.size,
        totalValue: entry.value,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const grandTotalValue = valuation.reduce((sum, r) => sum + r.totalValue, 0);
  const totalSkus = valuation.reduce((sum, r) => sum + r.itemCount, 0);

  return (
    <>
      <style>{"@media print{ aside,header{display:none!important} main{padding:0!important} }"}</style>

      <PageHeader title="Reports" description="Inventory valuation, low stock, and the movement ledger.">
        <PrintButton />
      </PageHeader>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Inventory valuation by category
        </h2>
        {!canCost ? (
          <p className="text-sm text-muted">Cost figures are restricted for your role.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatTile label="Grand total value" value={formatPHP(grandTotalValue)} />
              <StatTile label="Total SKUs" value={totalSkus} />
            </div>
            <TableWrap>
              <Table>
                <THead>
                  <Th>Category</Th>
                  <Th numeric># items</Th>
                  <Th numeric>Total value</Th>
                </THead>
                <TBody>
                  {valuation.length === 0 ? (
                    <EmptyRow colSpan={3}>No stock on hand to value.</EmptyRow>
                  ) : (
                    <>
                      {valuation.map((r) => (
                        <Tr key={r.id}>
                          <Td>{r.name}</Td>
                          <Td numeric>{r.itemCount}</Td>
                          <Td numeric>{formatPHP(r.totalValue)}</Td>
                        </Tr>
                      ))}
                      <Tr className="font-semibold">
                        <Td>Total</Td>
                        <Td numeric>{totalSkus}</Td>
                        <Td numeric>{formatPHP(grandTotalValue)}</Td>
                      </Tr>
                    </>
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Low stock</h2>
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
                    <Td numeric muted>{formatQty(row.reorderPoint)}</Td>
                    <Td numeric muted>{formatQty(row.reorderQty)}</Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Movement ledger</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Item</Th>
              <Th>Warehouse</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Balance</Th>
            </THead>
            <TBody>
              {movements.length === 0 ? (
                <EmptyRow colSpan={6}>No movements recorded.</EmptyRow>
              ) : (
                movements.map((m) => {
                  const q = Number(m.quantity);
                  return (
                    <Tr key={m.id}>
                      <Td muted className="whitespace-nowrap text-xs">
                        {formatManila(m.createdAt)}
                      </Td>
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
