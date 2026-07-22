"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatManila } from "@/lib/ph";
import { ReceiveTransferButton } from "./ReceiveTransferButton";

interface TransferRow {
  id: string;
  transferNumber: string;
  status: string;
  dispatchedAt: Date | null;
  receivedAt: Date | null;
  remarks: string | null;
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
}

export function TransfersTable({ transfers, canReceive }: { transfers: TransferRow[]; canReceive: boolean }) {
  const [query, setQuery] = useState("");
  const filtered = transfers.filter((t) =>
    rowMatches([t.transferNumber, t.fromWarehouse.name, t.toWarehouse.name], query),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Transfers</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search transfer # or warehouse…" />
      </div>

      <TableWrap>
        <Table>
          <THead>
            <Th>Transfer #</Th>
            <Th>From</Th>
            <Th>To</Th>
            <Th>Status</Th>
            <Th>Dispatched</Th>
            <Th>Received</Th>
            <Th />
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={7}>
                {transfers.length === 0 ? "No transfers yet." : "No transfers match your search."}
              </EmptyRow>
            ) : (
              filtered.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium">
                    <Link href={`/transfers/${t.id}`} className="text-ink-soft hover:text-ink hover:underline">
                      {t.transferNumber}
                    </Link>
                  </Td>
                  <Td muted>{t.fromWarehouse.name}</Td>
                  <Td muted>{t.toWarehouse.name}</Td>
                  <Td>
                    <StatusBadge value={t.status} />
                  </Td>
                  <Td muted>{t.dispatchedAt ? formatManila(t.dispatchedAt) : "—"}</Td>
                  <Td muted>{t.receivedAt ? formatManila(t.receivedAt) : "—"}</Td>
                  <Td>
                    {t.status === "IN_TRANSIT" && canReceive ? <ReceiveTransferButton id={t.id} /> : null}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
