import { notFound } from "next/navigation";
import { getGoodsReceipt } from "@/lib/services/receiving";
import { can, requirePermissionPage } from "@/lib/auth/dal";
import { PhotoManager } from "@/components/PhotoManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export default async function GoodsReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("grn:read");
  const { id } = await params;

  const grn = await getGoodsReceipt(id).catch(() => null);
  if (!grn) notFound();
  const canAddPhotos = await can("grn:create");

  return (
    <>
      <PageHeader title={grn.grnNumber} description={`Goods receipt — PO ${grn.po.poNumber}`} />

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">PO #</div>
          <div className="mt-1 text-sm text-ink">{grn.po.poNumber}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Supplier</div>
          <div className="mt-1 text-sm text-ink">{grn.po.supplier.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Warehouse</div>
          <div className="mt-1 text-sm text-ink">{grn.warehouse.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Status</div>
          <div className="mt-1">
            <StatusBadge value={grn.status} />
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Received date</div>
          <div className="mt-1 tabular text-sm text-ink">{grn.receivedDate}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Supplier DR #</div>
          <div className="mt-1 tabular text-sm text-ink">{grn.supplierDrNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Supplier invoice #</div>
          <div className="mt-1 tabular text-sm text-ink">{grn.supplierInvoiceNumber ?? "—"}</div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Received</Th>
              <Th numeric>Rejected</Th>
              <Th numeric>Unit cost</Th>
              <Th>Remarks</Th>
            </THead>
            <TBody>
              {grn.lines.length === 0 ? (
                <EmptyRow colSpan={5}>No lines on this goods receipt.</EmptyRow>
              ) : (
                grn.lines.map((line) => {
                  const rejected = Number(line.qtyRejected);
                  return (
                    <Tr key={line.id}>
                      <Td>
                        <span className="text-ink">{line.item.name}</span>{" "}
                        <span className="tabular text-xs text-muted">{line.item.sku}</span>
                      </Td>
                      <Td numeric>
                        {formatQty(line.qtyReceived)} {uomLabel(line.item.uom)}
                      </Td>
                      <Td numeric className={rejected > 0 ? "text-alert" : undefined}>
                        {formatQty(line.qtyRejected)} {uomLabel(line.item.uom)}
                      </Td>
                      <Td numeric>{formatPHP(line.unitCost)}</Td>
                      <Td muted>{line.remarks ?? "—"}</Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      <PhotoManager
        entity="goods_receipt"
        entityId={grn.id}
        canWrite={canAddPhotos}
        title="Delivery photos"
      />
    </>
  );
}
