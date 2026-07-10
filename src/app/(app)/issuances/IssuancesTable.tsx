"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";

interface IssuanceRow {
  id: string;
  issueNumber: string;
  status: string;
  receivedByName: string;
  mr: { mrNumber: string };
  project: { name: string };
  warehouse: { name: string };
}

export function IssuancesTable({ issuances }: { issuances: IssuanceRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = issuances.filter((i) =>
    rowMatches([i.issueNumber, i.mr.mrNumber, i.project.name, i.warehouse.name, i.receivedByName], query),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent issuances</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search issue # or MR #…" />
      </div>

      <TableWrap>
        <Table>
          <THead>
            <Th>Issue #</Th>
            <Th>MR #</Th>
            <Th>Project</Th>
            <Th>Warehouse</Th>
            <Th>Received by</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>
                {issuances.length === 0 ? "No issuances yet." : "No issuances match your search."}
              </EmptyRow>
            ) : (
              filtered.map((i) => (
                <Tr key={i.id}>
                  <Td className="font-medium text-ink">{i.issueNumber}</Td>
                  <Td muted>{i.mr.mrNumber}</Td>
                  <Td>{i.project.name}</Td>
                  <Td muted>{i.warehouse.name}</Td>
                  <Td muted>{i.receivedByName}</Td>
                  <Td>
                    <StatusBadge value={i.status} />
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
