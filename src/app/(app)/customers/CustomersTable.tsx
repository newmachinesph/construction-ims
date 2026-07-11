"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { CustomerForm, type CustomerRow } from "./CustomerForm";

function matches(fields: (string | null)[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

export function CustomersTable({ rows, canWrite }: { rows: CustomerRow[]; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = rows.filter((r) => matches([r.code, r.name, r.tin, r.phone], query));
  const colCount = canWrite ? 6 : 5;

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={query} onChange={setQuery} placeholder="Search code, name, TIN, phone…" />
      <TableWrap>
        <Table>
          <THead>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>TIN</Th>
            <Th>Phone</Th>
            <Th>Status</Th>
            {canWrite ? <Th /> : null}
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={colCount}>No customers match.</EmptyRow>
            ) : (
              filtered.map((r) => {
                const isEditing = editingId === r.id;
                return [
                  <Tr key={r.id}>
                    <Td className="tabular text-ink-soft">{r.code}</Td>
                    <Td>{r.name}</Td>
                    <Td muted className="tabular text-xs">{r.tin ?? "—"}</Td>
                    <Td muted>{r.phone ?? "—"}</Td>
                    <Td muted className="text-xs">{r.isActive ? "Active" : "Inactive"}</Td>
                    {canWrite ? (
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={isEditing ? "Cancel edit" : `Edit ${r.name}`}
                          aria-expanded={isEditing}
                          onClick={() => setEditingId(isEditing ? null : r.id)}
                        >
                          {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
                        </Button>
                      </Td>
                    ) : null}
                  </Tr>,
                  isEditing ? (
                    <tr key={`${r.id}-edit`} className="border-b border-line bg-surface-2">
                      <td colSpan={colCount} className="px-3 py-4">
                        <CustomerForm mode="edit" customer={r} onDone={() => setEditingId(null)} />
                      </td>
                    </tr>
                  ) : null,
                ];
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </div>
  );
}
