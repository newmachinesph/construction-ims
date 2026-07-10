"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatPHP } from "@/lib/ph";

interface PoRow {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  total: string;
  netPayable: string;
  supplier: { name: string };
}

export function PurchaseOrdersTable({ pos }: { pos: PoRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = pos.filter((po) => rowMatches([po.poNumber, po.supplier.name], query));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SearchInput value={query} onChange={setQuery} placeholder="Search PO # or supplier…" />
      </div>

      <TableWrap>
        <Table>
          <THead>
            <Th>PO #</Th>
            <Th>Supplier</Th>
            <Th>Status</Th>
            <Th>Order date</Th>
            <Th numeric>Total</Th>
            <Th numeric>Net payable</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>
                {pos.length === 0 ? "No purchase orders yet." : "No purchase orders match your search."}
              </EmptyRow>
            ) : (
              filtered.map((po) => (
                <Tr key={po.id}>
                  <Td>
                    <Link href={`/purchase-orders/${po.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                      {po.poNumber}
                    </Link>
                  </Td>
                  <Td>{po.supplier.name}</Td>
                  <Td>
                    <StatusBadge value={po.status} />
                  </Td>
                  <Td muted>{po.orderDate}</Td>
                  <Td numeric>{formatPHP(po.total)}</Td>
                  <Td numeric>{formatPHP(po.netPayable)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </div>
  );
}
