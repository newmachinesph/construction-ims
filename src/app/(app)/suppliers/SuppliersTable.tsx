"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { SupplierForm } from "./SupplierForm";

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  tin: string | null;
  vatStatus: string;
  ewtApplicable: boolean;
  ewtRate: string;
  atcCode: string;
  leadTimeDays: number;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export function SuppliersTable({ rows, canWrite }: { rows: SupplierRow[]; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = rows.filter((r) => rowMatches([r.code, r.name, r.tin], query));
  const colCount = canWrite ? 7 : 6;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search code, name, TIN…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} suppliers
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>TIN</Th>
            <Th>VAT status</Th>
            <Th numeric>EWT</Th>
            <Th numeric>Lead time</Th>
            {canWrite ? <Th /> : null}
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={colCount}>No suppliers match your search.</EmptyRow>
            ) : (
              filtered.flatMap((r) => {
                const isEditing = editingId === r.id;
                const row = (
                  <Tr key={r.id}>
                    <Td className="tabular text-ink-soft">{r.code}</Td>
                    <Td className="text-ink">{r.name}</Td>
                    <Td muted className="tabular">
                      {r.tin ?? "—"}
                    </Td>
                    <Td>
                      <StatusBadge value={r.vatStatus} tone="outline" />
                    </Td>
                    <Td numeric muted>
                      {r.ewtApplicable ? `${(Number(r.ewtRate) * 100).toFixed(2)}%` : "—"}
                    </Td>
                    <Td numeric muted>
                      {r.leadTimeDays}d
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
                      <SupplierForm mode="edit" supplier={r} onDone={() => setEditingId(null)} />
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
