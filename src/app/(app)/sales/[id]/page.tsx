import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { getSale } from "@/lib/services/sales";
import { formatManila, formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/app/(app)/reports/PrintButton";
import { VoidSaleButton } from "./VoidSaleButton";
import { Table, TableWrap, THead, TBody, Th, Tr, Td } from "@/components/ui/Table";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

/** The browser names a "Save as PDF" download after the document title, so this
 *  makes the invoice download as `SI-000123.pdf` rather than the page title. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sale = await getSale(id);
  return { title: sale.siNumber };
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("sale:read");
  const { id } = await params;

  const [sale, settings, canCost, canVoid] = await Promise.all([
    getSale(id),
    db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) }),
    can("report:cost"),
    can("sale:void"),
  ]);

  const buyer = sale.customer?.name ?? sale.customerName ?? "Walk-in customer";
  const buyerTin = sale.customer?.tin ?? sale.customerTin;
  const change =
    sale.amountTendered !== null ? Number(sale.amountTendered) - Number(sale.total) : null;

  // Margin is cost data — gated, same as everywhere else.
  const cogs = sale.lines.reduce((sum, l) => sum + Number(l.unitCost) * Number(l.quantity), 0);
  const margin = Number(sale.subtotal) - cogs;

  return (
    <>
      <style>{"@media print{ aside,header,.no-print{display:none!important} main{padding:0!important} }"}</style>

      <PageHeader title={`Sales invoice ${sale.siNumber}`} description={formatManila(sale.createdAt)}>
        <span className="no-print flex items-center gap-2">
          <PrintButton />
          {canVoid && sale.status === "POSTED" ? (
            <VoidSaleButton saleId={sale.id} siNumber={sale.siNumber} />
          ) : null}
        </span>
      </PageHeader>

      {sale.status === "CANCELLED" ? (
        <p className="rounded-card border border-alert px-4 py-3 text-sm text-alert" role="status">
          This invoice was VOIDED and the stock restored. It stays on the books — the BIR serial
          cannot be reused.
          {sale.notes ? <span className="block text-xs text-muted">Reason: {sale.notes}</span> : null}
        </p>
      ) : null}

      <section className="rounded-card border border-line bg-surface p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <div className="text-sm font-semibold text-ink">{settings?.name ?? "—"}</div>
            {settings?.address ? <div className="text-xs text-muted">{settings.address}</div> : null}
            {settings?.tin ? <div className="tabular text-xs text-muted">TIN {settings.tin}</div> : null}
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted">
              {settings?.vatRegistered ? "VAT-registered" : "Non-VAT"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted">Sales invoice</div>
            <div className="tabular text-lg font-semibold text-ink">{sale.siNumber}</div>
            <div className="tabular text-xs text-muted">{sale.saleDate}</div>
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted">Sold to</dt>
            <dd className="text-sm text-ink">{buyer}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted">TIN</dt>
            <dd className="tabular text-sm text-ink">{buyerTin ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted">Cashier</dt>
            <dd className="text-sm text-ink">{sale.cashier?.fullName ?? "—"}</dd>
          </div>
        </dl>

        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Unit price</Th>
              <Th>VAT</Th>
              <Th numeric>Amount</Th>
            </THead>
            <TBody>
              {sale.lines.map((l) => (
                <Tr key={l.id}>
                  <Td>
                    <span className="text-ink">{l.item.name}</span>{" "}
                    <span className="tabular text-xs text-muted">{l.item.sku}</span>
                  </Td>
                  <Td numeric>
                    {formatQty(l.quantity)} {uomLabel(l.item.uom)}
                  </Td>
                  <Td numeric>{formatPHP(l.unitPrice)}</Td>
                  <Td muted className="text-xs">{l.vatClass.replace("_", " ")}</Td>
                  <Td numeric>{formatPHP(l.lineTotal)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>

        <div className="mt-6 flex justify-end">
          <dl className="flex w-full max-w-xs flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">VATable sales</dt>
              <dd className="tabular text-ink-soft">{formatPHP(sale.vatableSales)}</dd>
            </div>
            {Number(sale.zeroRatedSales) > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Zero-rated sales</dt>
                <dd className="tabular text-ink-soft">{formatPHP(sale.zeroRatedSales)}</dd>
              </div>
            ) : null}
            {Number(sale.exemptSales) > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">VAT-exempt sales</dt>
                <dd className="tabular text-ink-soft">{formatPHP(sale.exemptSales)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">Output VAT (12%)</dt>
              <dd className="tabular text-ink-soft">{formatPHP(sale.vatAmount)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt className="text-ink">Total</dt>
              <dd className="tabular text-ink">{formatPHP(sale.total)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-2">
              <dt className="text-muted">Paid via</dt>
              <dd className="text-ink-soft">{sale.paymentMethod.replace("_", " ")}</dd>
            </div>
            {sale.amountTendered !== null ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted">Tendered</dt>
                  <dd className="tabular text-ink-soft">{formatPHP(sale.amountTendered)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Change</dt>
                  <dd className="tabular text-ink-soft">{formatPHP(change ?? 0)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        {canCost ? (
          <div className="no-print mt-6 flex justify-end gap-6 border-t border-line pt-4 text-xs text-muted">
            <span>
              COGS <span className="tabular text-ink-soft">{formatPHP(cogs)}</span>
            </span>
            <span>
              Gross margin <span className="tabular text-ink-soft">{formatPHP(margin)}</span>
            </span>
          </div>
        ) : null}
      </section>
    </>
  );
}
