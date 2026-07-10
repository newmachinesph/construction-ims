import { notFound } from "next/navigation";
import { getAdjustment } from "@/lib/services/stock";
import { can, requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatManila, formatQty, UOM_LABELS } from "@/lib/ph";
import { ApproveAdjustmentButton } from "../ApproveAdjustmentButton";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export default async function AdjustmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("adjustment:read");
  const { id } = await params;

  const adj = await getAdjustment(id).catch(() => null);
  if (!adj) notFound();
  const canApprove = adj.status === "DRAFT" && (await can("adjustment:approve"));

  return (
    <>
      <PageHeader title={adj.adjustmentNumber} description={`Stock adjustment — ${adj.warehouse.name}`} />

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Adjustment #</div>
          <div className="mt-1 tabular text-sm text-ink">{adj.adjustmentNumber}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Warehouse</div>
          <div className="mt-1 text-sm text-ink">{adj.warehouse.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Reason</div>
          <div className="mt-1 text-sm text-ink">{adj.reason}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Status</div>
          <div className="mt-1">
            <StatusBadge value={adj.status} />
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Created</div>
          <div className="mt-1 tabular text-sm text-ink">{formatManila(adj.createdAt)}</div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Qty delta</Th>
              <Th>Remarks</Th>
            </THead>
            <TBody>
              {adj.lines.length === 0 ? (
                <EmptyRow colSpan={3}>No lines on this adjustment.</EmptyRow>
              ) : (
                adj.lines.map((line) => {
                  const delta = Number(line.qtyDelta);
                  const isNegative = delta < 0;
                  return (
                    <Tr key={line.id}>
                      <Td>
                        <span className="text-ink">{line.item.name}</span>{" "}
                        <span className="tabular text-xs text-muted">{line.item.sku}</span>
                      </Td>
                      <Td numeric className={isNegative ? "text-alert" : undefined}>
                        {isNegative ? "−" : "+"}
                        {formatQty(Math.abs(delta))} {uomLabel(line.item.uom)}
                      </Td>
                      <Td muted>{line.remarks ?? "—"}</Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      {canApprove ? <ApproveAdjustmentButton id={adj.id} /> : null}
    </>
  );
}
