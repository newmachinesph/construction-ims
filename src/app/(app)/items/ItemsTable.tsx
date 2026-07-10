"use client";

import { useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";

interface ItemRow {
  id: string;
  sku: string;
  name: string;
  uom: string;
  standardCost: string;
  reorderPoint: string;
  reorderQty: string;
  isWeatherSensitive: boolean;
  categoryName: string;
}

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export function ItemsTable({ rows }: { rows: ItemRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) => rowMatches([r.sku, r.name, r.categoryName], query));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search SKU, name, category…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} items
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th>SKU</Th>
            <Th>Name</Th>
            <Th>Category</Th>
            <Th>UoM</Th>
            <Th numeric>Standard cost</Th>
            <Th numeric>Reorder pt.</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6}>No items match your search.</EmptyRow>
            ) : (
              filtered.map((r) => (
                <Tr key={r.id}>
                  <Td className="tabular">
                    <Link href={`/items/${r.id}`} className="text-ink-soft underline-offset-2 hover:text-ink hover:underline">
                      {r.sku}
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-ink">{r.name}</span>
                    {r.isWeatherSensitive ? (
                      <span
                        title="Weather-sensitive — extra buffer during rainy season"
                        className="ml-2 inline-flex items-center rounded border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-muted"
                      >
                        WX
                      </span>
                    ) : null}
                  </Td>
                  <Td muted>{r.categoryName}</Td>
                  <Td muted>{uomLabel(r.uom)}</Td>
                  <Td numeric>{formatPHP(r.standardCost)}</Td>
                  <Td numeric muted>
                    {formatQty(r.reorderPoint)}
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
