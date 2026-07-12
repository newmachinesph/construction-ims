import { formatPHP, formatQty } from "@/lib/ph";
import type { SalesReport } from "@/lib/services/salesReport";
import { StatTile } from "@/components/ui/StatTile";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";

/**
 * End-of-day sales breakdown.
 *
 * Split by COGS and Net so the day's takings can be booked to the COGS account
 * and the Net account separately:  net sales − COGS = Net (gross profit).
 * All figures are VAT-exclusive; output VAT is shown on its own because it is a
 * liability to the BIR, not revenue.
 *
 * Cost and margin are gated behind `report:cost` — a cashier must not see them.
 */
export function SalesReportSection({
  report,
  canCost,
  from,
  to,
}: {
  report: SalesReport;
  canCost: boolean;
  from: string;
  to: string;
}) {
  const t = report.totals;
  const stamp = from === to ? from : `${from}_to_${to}`;

  const categoryCsv = report.byCategory.map((c) => ({
    category: c.name,
    qty: String(c.qty),
    netSales: c.netSales.toFixed(2),
    cogs: c.cogs.toFixed(2),
    net: c.margin.toFixed(2),
  }));

  const itemCsv = report.byItem.map((i) => ({
    sku: i.sku,
    item: i.name,
    category: i.category,
    qty: String(i.qty),
    uom: i.uom,
    netSales: i.netSales.toFixed(2),
    cogs: i.cogs.toFixed(2),
    net: i.margin.toFixed(2),
  }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Net sales" value={formatPHP(t.netSales)} hint="Excluding output VAT" />
        {canCost ? (
          <>
            <StatTile label="COGS" value={formatPHP(t.cogs)} hint="Cost of goods sold" />
            <StatTile
              label="Net"
              value={formatPHP(t.margin)}
              hint={`${t.marginPct.toFixed(1)}% of net sales`}
            />
          </>
        ) : (
          <StatTile label="Invoices" value={t.invoices} hint={`Avg ${formatPHP(t.avgSale)}`} />
        )}
        <StatTile label="Output VAT" value={formatPHP(t.vat)} hint="Payable to the BIR" />
      </div>

      {/* ------------------------------ by category ------------------------------ */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            By category — COGS vs Net
          </h2>
          <ExportCsvButton
            filename={`sales-by-category-${stamp}`}
            rows={categoryCsv}
            columns={[
              { key: "category", label: "Category" },
              { key: "qty", label: "Qty" },
              { key: "netSales", label: "Net sales (PHP)" },
              ...(canCost
                ? ([
                    { key: "cogs", label: "COGS (PHP)" },
                    { key: "net", label: "Net (PHP)" },
                  ] as const)
                : []),
            ]}
          />
        </div>

        <TableWrap>
          <Table>
            <THead>
              <Th>Category</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Net sales</Th>
              {canCost ? <Th numeric>COGS</Th> : null}
              {canCost ? <Th numeric>Net</Th> : null}
            </THead>
            <TBody>
              {report.byCategory.length === 0 ? (
                <EmptyRow colSpan={canCost ? 5 : 3}>No sales in this range.</EmptyRow>
              ) : (
                <>
                  {report.byCategory.map((c) => (
                    <Tr key={c.name}>
                      <Td>{c.name}</Td>
                      <Td numeric muted>{formatQty(c.qty)}</Td>
                      <Td numeric>{formatPHP(c.netSales)}</Td>
                      {canCost ? <Td numeric muted>{formatPHP(c.cogs)}</Td> : null}
                      {canCost ? <Td numeric>{formatPHP(c.margin)}</Td> : null}
                    </Tr>
                  ))}
                  <Tr className="font-semibold">
                    <Td>Total</Td>
                    <Td numeric>{formatQty(report.byCategory.reduce((s, c) => s + c.qty, 0))}</Td>
                    <Td numeric>{formatPHP(t.netSales)}</Td>
                    {canCost ? <Td numeric>{formatPHP(t.cogs)}</Td> : null}
                    {canCost ? <Td numeric>{formatPHP(t.margin)}</Td> : null}
                  </Tr>
                </>
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      {/* -------------------------------- by item -------------------------------- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Items sold
          </h2>
          <ExportCsvButton
            filename={`items-sold-${stamp}`}
            rows={itemCsv}
            columns={[
              { key: "sku", label: "SKU" },
              { key: "item", label: "Item" },
              { key: "category", label: "Category" },
              { key: "qty", label: "Qty" },
              { key: "uom", label: "UoM" },
              { key: "netSales", label: "Net sales (PHP)" },
              ...(canCost
                ? ([
                    { key: "cogs", label: "COGS (PHP)" },
                    { key: "net", label: "Net (PHP)" },
                  ] as const)
                : []),
            ]}
          />
        </div>

        <TableWrap>
          <Table>
            <THead>
              <Th>SKU</Th>
              <Th>Item</Th>
              <Th>Category</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Net sales</Th>
              {canCost ? <Th numeric>COGS</Th> : null}
              {canCost ? <Th numeric>Net</Th> : null}
            </THead>
            <TBody>
              {report.byItem.length === 0 ? (
                <EmptyRow colSpan={canCost ? 7 : 5}>No items sold in this range.</EmptyRow>
              ) : (
                report.byItem.map((i) => (
                  <Tr key={i.sku}>
                    <Td className="tabular text-ink-soft">{i.sku}</Td>
                    <Td>{i.name}</Td>
                    <Td muted>{i.category}</Td>
                    <Td numeric>
                      {formatQty(i.qty)} <span className="text-xs text-muted">{i.uom}</span>
                    </Td>
                    <Td numeric>{formatPHP(i.netSales)}</Td>
                    {canCost ? <Td numeric muted>{formatPHP(i.cogs)}</Td> : null}
                    {canCost ? <Td numeric>{formatPHP(i.margin)}</Td> : null}
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>
    </>
  );
}
