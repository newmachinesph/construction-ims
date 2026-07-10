"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { WarehouseForm, type ProjectOption } from "./WarehouseForm";

export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  projectId: string | null;
  address: string | null;
  isActive: boolean;
  projectName: string | null;
}

export function WarehousesTable({
  rows,
  projects,
  canWrite,
}: {
  rows: WarehouseRow[];
  projects: ProjectOption[];
  canWrite: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = rows.filter((r) => rowMatches([r.code, r.name, r.projectName, r.address], query));
  const colCount = canWrite ? 7 : 6;

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
            <Th>Status</Th>
            {canWrite ? <Th /> : null}
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={colCount}>No warehouses match your search.</EmptyRow>
            ) : (
              filtered.flatMap((r) => {
                const isEditing = editingId === r.id;
                const row = (
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
                    <Td>
                      <StatusBadge value={r.isActive ? "ACTIVE" : "INACTIVE"} />
                    </Td>
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
                      <WarehouseForm
                        mode="edit"
                        warehouse={r}
                        projects={projects}
                        onDone={() => setEditingId(null)}
                      />
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
