"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatPHP } from "@/lib/ph";
import { ProjectForm } from "./ProjectForm";

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  location: string | null;
  status: string;
  startDate: string | null;
  targetEndDate: string | null;
  contractAmount: string | null;
}

export function ProjectsTable({ rows, canWrite }: { rows: ProjectRow[]; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = rows.filter((r) => rowMatches([r.code, r.name, r.clientName, r.location], query));
  const colCount = canWrite ? 7 : 6;

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
            {canWrite ? <Th /> : null}
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={colCount}>No projects match your search.</EmptyRow>
            ) : (
              filtered.flatMap((r) => {
                const isEditing = editingId === r.id;
                const row = (
                  <Tr key={r.id}>
                    <Td className="tabular text-ink-soft">{r.code}</Td>
                    <Td className="text-ink">{r.name}</Td>
                    <Td muted>{r.clientName ?? "—"}</Td>
                    <Td muted>{r.location ?? "—"}</Td>
                    <Td>
                      <StatusBadge value={r.status} />
                    </Td>
                    <Td numeric>{r.contractAmount ? formatPHP(r.contractAmount) : "—"}</Td>
                    {canWrite ? (
                      <Td numeric>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(isEditing ? null : r.id)}
                        >
                          {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
                        </Button>
                      </Td>
                    ) : null}
                  </Tr>
                );
                if (!isEditing) return [row];
                return [
                  row,
                  <tr key={`${r.id}-edit`} className="border-t border-line bg-surface-2">
                    <td colSpan={colCount} className="px-3 py-4">
                      <ProjectForm mode="edit" project={r} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>,
                ];
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
