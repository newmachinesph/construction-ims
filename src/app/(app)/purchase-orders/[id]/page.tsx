import { notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/services/procurement";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";
import { PoActions } from "./PoActions";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("po:read");
  const { id } = await params;

  const po = await getPurchaseOrder(id).catch(() => null);
  if (!po) notFound();

  const [canApprove, canCancel] = await Promise.all([can("po:approve"), can("po:cancel")]);

  return (
    <>
      <PageHeader title={po.poNumber} description={`Purchase order — ${po.supplier.name}`}>
        <PoActions id={po.id} status={po.status} canApprove={canApprove} canCancel={canCancel} />
      </PageHeader>

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Supplier</div>
          <div className="mt-1 text-sm text-ink">{po.supplier.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Warehouse</div>
          <div className="mt-1 text-sm text-ink">{po.warehouse.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Project</div>
          <div className="mt-1 text-sm text-ink">{po.project?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Status</div>
          <div className="mt-1">
            <StatusBadge value={po.status} />
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Order date</div>
          <div className="mt-1 tabular text-sm text-ink">{po.orderDate}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Expected date</div>
          <div className="mt-1 tabular text-sm text-ink">{po.expectedDate ?? "—"}</div>
        </div>
        {po.notes ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Notes</div>
            <div className="mt-1 text-sm text-ink-soft">{po.notes}</div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Ordered</Th>
              <Th numeric>Received</Th>
              <Th numeric>Unit price</Th>
              <Th>VAT class</Th>
              <Th numeric>Line total</Th>
            </THead>
            <TBody>
              {po.lines.length === 0 ? (
                <EmptyRow colSpan={6}>No lines on this purchase order.</EmptyRow>
              ) : (
                po.lines.map((line) => (
                  <Tr key={line.id}>
                    <Td>
                      <span className="text-ink">{line.item.name}</span>{" "}
                      <span className="tabular text-xs text-muted">{line.item.sku}</span>
                    </Td>
                    <Td numeric>
                      {formatQty(line.qtyOrdered)} {uomLabel(line.item.uom)}
                    </Td>
                    <Td numeric muted>
                      {formatQty(line.qtyReceived)} {uomLabel(line.item.uom)}
                    </Td>
                    <Td numeric>{formatPHP(line.unitPrice)}</Td>
                    <Td>
                      <StatusBadge value={line.vatClass} tone="muted" />
                    </Td>
                    <Td numeric>{formatPHP(line.lineTotal)}</Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      <section className="flex justify-end">
        <div className="flex w-full max-w-xs flex-col gap-2 rounded-card border border-line bg-surface p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="tabular text-ink">{formatPHP(po.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">VAT</span>
            <span className="tabular text-ink">{formatPHP(po.vatAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">EWT</span>
            <span className="tabular text-ink">{formatPHP(po.ewtAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2">
            <span className="text-muted">Total</span>
            <span className="tabular text-ink">{formatPHP(po.total)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line-strong pt-2">
            <span className="font-medium text-ink">Net payable</span>
            <span className="tabular text-lg font-semibold text-ink">{formatPHP(po.netPayable)}</span>
          </div>
        </div>
      </section>
    </>
  );
}
