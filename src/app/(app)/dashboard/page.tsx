import { asc, count, eq, inArray } from "drizzle-orm";
import { Boxes, FileWarning, PackageCheck, ShoppingCart } from "lucide-react";
import { db } from "@/db";
import { items, materialRequisitions, purchaseOrders, warehouses } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { lowStockItems, recentMovements, listStock } from "@/lib/services/stock";
import { salesReport, type Granularity } from "@/lib/services/salesReport";
import { uomLabelMap } from "@/lib/services/uom";
import { formatManila, formatPHP, formatQty, manilaToday } from "@/lib/ph";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { BarChart } from "@/components/charts/BarChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { SalesRangeForm } from "./SalesRangeForm";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Trust nothing from the query string: fall back to a sane range. */
function parseRange(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const today = manilaToday();
  const rawFrom = one(sp.from);
  const rawTo = one(sp.to);
  const rawG = one(sp.granularity);

  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : today;
  // Default window: the last 30 days.
  const defaultFrom = new Date(`${to}T00:00:00Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const from =
    rawFrom && DATE_RE.test(rawFrom) ? rawFrom : defaultFrom.toISOString().slice(0, 10);

  const granularity: Granularity = rawG === "month" ? "month" : "day";
  // A backwards range would silently return nothing; swap it instead.
  return from <= to ? { from, to, granularity } : { from: to, to: from, granularity };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("stock:read");
  const [canCost, canSeeSales, sp, warehouseRows] = await Promise.all([
    can("report:cost"),
    can("sale:read"),
    searchParams,
    db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.isActive, true))
      .orderBy(asc(warehouses.name)),
  ]);

  const { from, to, granularity } = parseRange(sp);
  // Trust nothing from the query string: only a real warehouse id filters; anything
  // else falls back to the company-wide report.
  const rawWarehouse = Array.isArray(sp.warehouse) ? sp.warehouse[0] : sp.warehouse;
  const warehouseId = warehouseRows.some((w) => w.id === rawWarehouse) ? rawWarehouse : undefined;
  const report = canSeeSales ? await salesReport(from, to, granularity, warehouseId) : null;

  const [stock, lowStock, movements, activeSkuRows, openPoRows, pendingMrRows, uomLabels] =
    await Promise.all([
      listStock(),
      lowStockItems(),
      recentMovements(12),
      db.select({ n: count() }).from(items).where(eq(items.isActive, true)),
      db
        .select({ n: count() })
        .from(purchaseOrders)
        .where(inArray(purchaseOrders.status, ["APPROVED", "PARTIALLY_RECEIVED"])),
      db.select({ n: count() }).from(materialRequisitions).where(eq(materialRequisitions.status, "SUBMITTED")),
      uomLabelMap(),
    ]);
  const uomLabel = (code: string) => uomLabels[code] ?? code;

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

      {/* Sales report — date-ranged, daily or monthly. Shown first: the counter's
          day-to-day money picture leads; the inventory snapshot follows below. */}
      {report ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Sales report
              </h2>
              <p className="mt-1 text-xs text-muted">
                Posted sales only — a voided invoice is not revenue.
              </p>
            </div>
            <SalesRangeForm
              from={from}
              to={to}
              granularity={granularity}
              warehouses={warehouseRows}
              warehouse={warehouseId ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Net sales"
              value={formatPHP(report.totals.netSales)}
              hint="Excluding output VAT"
            />
            <StatTile label="Invoices" value={report.totals.invoices} hint={`Avg ${formatPHP(report.totals.avgSale)}`} />
            <StatTile label="Output VAT" value={formatPHP(report.totals.vat)} hint="Payable to the BIR" />
            {canCost ? (
              <StatTile
                label="Gross margin"
                value={formatPHP(report.totals.margin)}
                hint={`${report.totals.marginPct.toFixed(1)}% of net sales`}
              />
            ) : (
              <StatTile label="Gross sales" value={formatPHP(report.totals.gross)} hint="Including VAT" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                Net sales by {granularity === "month" ? "month" : "day"}
              </h3>
              <BarChart
                data={report.buckets.map((b) => ({
                  label: b.period,
                  value: b.netSales,
                  note: `${b.invoices} invoice${b.invoices === 1 ? "" : "s"}`,
                }))}
                emptyMessage="No sales in this range."
              />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                By category
              </h3>
              <RankedBars
                data={report.byCategory.map((c) => ({
                  name: c.name,
                  value: c.netSales,
                  note: `· ${formatQty(c.qty)}`,
                }))}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Inventory snapshot — the KPI tiles sit under the sales report now. */}
      <div className="grid grid-cols-2 gap-4 border-t border-line pt-6 lg:grid-cols-4">
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
