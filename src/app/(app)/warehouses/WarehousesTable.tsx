"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  address: string | null;
  isActive: boolean;
  projectName: string | null;
}

export function WarehousesTable({ rows }: { rows: WarehouseRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) => rowMatches([r.code, r.name, r.projectName, r.address], query));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search code, name, project, address…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} warehouses
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Kind</Th>
            <Th>Project</Th>
            <Th>Address</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={5}>No warehouses match your search.</EmptyRow>
            ) : (
              filtered.map((r) => (
                <Tr key={r.id}>
                  <Td className="tabular text-ink-soft">{r.code}</Td>
                  <Td className="text-ink">{r.name}</Td>
                  <Td>
                    <StatusBadge
                      tone="outline"
                      label={r.kind === "MAIN_WAREHOUSE" ? "MAIN" : "SITE"}
                      value={r.kind}
                    />
                  </Td>
                  <Td muted>{r.projectName ?? "—"}</Td>
                  <Td muted>{r.address ?? "—"}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
