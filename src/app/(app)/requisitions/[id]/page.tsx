import { notFound } from "next/navigation";
import { getRequisition } from "@/lib/services/requisition";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatQty, UOM_LABELS } from "@/lib/ph";
import { MrActions } from "./MrActions";

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("mr:read");
  const { id } = await params;

  const mr = await getRequisition(id).catch(() => null);
  if (!mr) notFound();

  const canApprove = await can("mr:approve");

  return (
    <>
      <PageHeader title={mr.mrNumber} description={`Material requisition — ${mr.project.name}`}>
        <MrActions id={mr.id} status={mr.status} canApprove={canApprove} />
      </PageHeader>

      <section className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Project</div>
          <div className="mt-1 text-sm text-ink">{mr.project.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Warehouse</div>
          <div className="mt-1 text-sm text-ink">{mr.warehouse.name}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Needed date</div>
          <div className="mt-1 tabular text-sm text-ink">{mr.neededDate}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Status</div>
          <div className="mt-1">
            <StatusBadge value={mr.status} />
          </div>
        </div>
        {mr.purpose ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Purpose</div>
            <div className="mt-1 text-sm text-ink-soft">{mr.purpose}</div>
          </div>
        ) : null}
        {mr.status === "REJECTED" && mr.rejectionReason ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="text-xs font-medium uppercase tracking-wider text-alert">Rejection reason</div>
            <div className="mt-1 text-sm text-ink-soft">{mr.rejectionReason}</div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Requested</Th>
              <Th numeric>Issued</Th>
            </THead>
            <TBody>
              {mr.lines.length === 0 ? (
                <EmptyRow colSpan={3}>No lines on this requisition.</EmptyRow>
              ) : (
                mr.lines.map((line) => (
                  <Tr key={line.id}>
                    <Td>
                      <span className="text-ink">{line.item.name}</span>{" "}
                      <span className="tabular text-xs text-muted">{line.item.sku}</span>
                    </Td>
                    <Td numeric>
                      {formatQty(line.qtyRequested)} {uomLabel(line.item.uom)}
                    </Td>
                    <Td numeric muted>
                      {formatQty(line.qtyIssued)} {uomLabel(line.item.uom)}
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
