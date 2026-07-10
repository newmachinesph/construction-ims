"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";

interface RequisitionRow {
  id: string;
  mrNumber: string;
  status: string;
  neededDate: string;
  purpose: string | null;
  project: { name: string };
  warehouse: { name: string };
  requester: { fullName: string };
}

export function RequisitionsTable({ mrs }: { mrs: RequisitionRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = mrs.filter((mr) =>
    rowMatches([mr.mrNumber, mr.project.name, mr.warehouse.name, mr.requester.fullName], query),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SearchInput value={query} onChange={setQuery} placeholder="Search MR # or project…" />
      </div>

      <TableWrap>
        <Table>
          <THead>
            <Th>MR #</Th>
            <Th>Project</Th>
            <Th>Warehouse</Th>
            <Th>Needed date</Th>
            <Th>Requester</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>
                {mrs.length === 0 ? "No requisitions yet." : "No requisitions match your search."}
              </EmptyRow>
            ) : (
              filtered.map((mr) => (
                <Tr key={mr.id}>
                  <Td>
                    <Link
                      href={`/requisitions/${mr.id}`}
                      className="font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {mr.mrNumber}
                    </Link>
                  </Td>
                  <Td>{mr.project.name}</Td>
                  <Td muted>{mr.warehouse.name}</Td>
                  <Td muted>{mr.neededDate}</Td>
                  <Td muted>{mr.requester.fullName}</Td>
                  <Td>
                    <StatusBadge value={mr.status} />
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </div>
  );
}
