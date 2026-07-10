"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatManila } from "@/lib/ph";

interface AuditRow {
  id: string;
  createdAt: Date;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) => rowMatches([r.actorEmail, r.action, r.entity], query));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search actor, action, entity…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} entries
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>Entity ID</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={5}>No audit entries match your search.</EmptyRow>
            ) : (
              filtered.map((r) => (
                <Tr key={r.id}>
                  <Td muted className="whitespace-nowrap text-xs">
                    {formatManila(r.createdAt)}
                  </Td>
                  <Td>{r.actorEmail ?? "system"}</Td>
                  <Td>
                    <StatusBadge value={r.action} tone="outline" />
                  </Td>
                  <Td muted>{r.entity}</Td>
                  <Td className="tabular text-xs text-muted">{r.entityId ?? "—"}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
