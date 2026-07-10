"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatPHP } from "@/lib/ph";

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  location: string | null;
  status: string;
  contractAmount: string | null;
}

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) => rowMatches([r.code, r.name, r.clientName, r.location], query));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search code, name, client, location…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} projects
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Client</Th>
            <Th>Location</Th>
            <Th>Status</Th>
            <Th numeric>Contract amount</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>No projects match your search.</EmptyRow>
            ) : (
              filtered.map((r) => (
                <Tr key={r.id}>
                  <Td className="tabular text-ink-soft">{r.code}</Td>
                  <Td className="text-ink">{r.name}</Td>
                  <Td muted>{r.clientName ?? "—"}</Td>
                  <Td muted>{r.location ?? "—"}</Td>
                  <Td>
                    <StatusBadge value={r.status} />
                  </Td>
                  <Td numeric>{r.contractAmount ? formatPHP(r.contractAmount) : "—"}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
