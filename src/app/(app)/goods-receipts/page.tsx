import Link from "next/link";
import { listGoodsReceipts } from "@/lib/services/receiving";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";

export default async function GoodsReceiptsPage() {
  await requirePermissionPage("grn:read");
  const [grns, canCreate] = await Promise.all([listGoodsReceipts(), can("grn:create")]);

  return (
    <>
      <PageHeader title="Goods receipts" description="Receipts posted against approved purchase orders.">
        {canCreate ? (
          <Link href="/goods-receipts/new">
            <Button>Receive against PO</Button>
          </Link>
        ) : null}
      </PageHeader>

      <TableWrap>
        <Table>
          <THead>
            <Th>GRN #</Th>
            <Th>PO #</Th>
            <Th>Supplier</Th>
            <Th>Warehouse</Th>
            <Th>Received date</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {grns.length === 0 ? (
              <EmptyRow colSpan={6}>No goods receipts yet.</EmptyRow>
            ) : (
              grns.map((grn) => (
                <Tr key={grn.id}>
                  <Td>
                    <Link
                      href={`/goods-receipts/${grn.id}`}
                      className="font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {grn.grnNumber}
                    </Link>
                  </Td>
                  <Td muted>{grn.po.poNumber}</Td>
                  <Td>{grn.po.supplier.name}</Td>
                  <Td muted>{grn.warehouse.name}</Td>
                  <Td muted>{grn.receivedDate}</Td>
                  <Td>
                    <StatusBadge value={grn.status} />
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}
