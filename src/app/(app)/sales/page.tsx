import Link from "next/link";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { listSales } from "@/lib/services/sales";
import { formatManila, formatPHP } from "@/lib/ph";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";

export default async function SalesPage() {
  await requirePermissionPage("sale:read");
  const [rows, canSell] = await Promise.all([listSales(), can("sale:create")]);

  return (
    <>
      <PageHeader title="Sales" description="Counter sales and their BIR sales invoices.">
        {canSell ? (
          <Link href="/pos">
            <Button size="sm">New sale</Button>
          </Link>
        ) : null}
      </PageHeader>

      <TableWrap>
        <Table>
          <THead>
            <Th>Invoice</Th>
            <Th>When</Th>
            <Th>Customer</Th>
            <Th>Warehouse</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th numeric>Total</Th>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>No sales yet.</EmptyRow>
            ) : (
              rows.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <Link href={`/sales/${s.id}`} className="tabular text-ink underline-offset-4 hover:underline">
                      {s.siNumber}
                    </Link>
                  </Td>
                  <Td muted className="whitespace-nowrap text-xs">
                    {formatManila(s.createdAt)}
                  </Td>
                  <Td>{s.customer?.name ?? s.customerName ?? "Walk-in"}</Td>
                  <Td muted>{s.warehouse?.name}</Td>
                  <Td muted>{s.paymentMethod.replace("_", " ")}</Td>
                  <Td>
                    <StatusBadge value={s.status} />
                  </Td>
                  <Td numeric>{formatPHP(s.total)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}
