import { notFound } from "next/navigation";
import { getTransfer } from "@/lib/services/stock";
import { uomLabelMap } from "@/lib/services/uom";
import { requirePermissionPage } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatManila, formatQty } from "@/lib/ph";

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("transfer:read");
  const { id } = await params;

  const [transfer, uomLabels] = await Promise.all([
    getTransfer(id).catch(() => null),
    uomLabelMap(),
  ]);
  if (!transfer) notFound();

  return (
    <>
      <PageHeader
        title={transfer.transferNumber}
        description={`Stock transfer — ${transfer.fromWarehouse.name} → ${transfer.toWarehouse.name}`}
      />

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">From warehouse</div>
          <div className="mt-1 text-sm text-ink">{transfer.fromWarehouse.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">To warehouse</div>
          <div className="mt-1 text-sm text-ink">{transfer.toWarehouse.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Status</div>
          <div className="mt-1">
            <StatusBadge value={transfer.status} />
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Created</div>
          <div className="mt-1 tabular text-sm text-ink">{formatManila(transfer.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Dispatched at</div>
          <div className="mt-1 tabular text-sm text-ink">
            {transfer.dispatchedAt ? formatManila(transfer.dispatchedAt) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Received at</div>
          <div className="mt-1 tabular text-sm text-ink">
            {transfer.receivedAt ? formatManila(transfer.receivedAt) : "—"}
          </div>
        </div>
        {transfer.remarks ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Remarks</div>
            <div className="mt-1 text-sm text-ink-soft">{transfer.remarks}</div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Qty</Th>
            </THead>
            <TBody>
              {transfer.lines.length === 0 ? (
                <EmptyRow colSpan={2}>No lines on this transfer.</EmptyRow>
              ) : (
                transfer.lines.map((line) => (
                  <Tr key={line.id}>
                    <Td>
                      <span className="text-ink">{line.item.name}</span>{" "}
                      <span className="tabular text-xs text-muted">{line.item.sku}</span>
                    </Td>
                    <Td numeric>
                      {formatQty(line.quantity)} {uomLabels[line.item.uom] ?? line.item.uom}
                    </Td>
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
