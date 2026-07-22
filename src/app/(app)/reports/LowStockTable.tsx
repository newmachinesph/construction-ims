"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatQty, UOM_LABELS } from "@/lib/ph";

interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  uom: string;
  reorderPoint: string;
  reorderQty: string;
  isWeatherSensitive: boolean;
  totalOnHand: string;
}

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export function LowStockTable({ rows }: { rows: LowStockRow[] }) {
  const [search, setSearch] = useState("");

  // ponytail: in-memory filter, no debounce — array is already loaded, filtering is instant.
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    : rows;

  return (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Search SKU or item…" />
      <TableWrap>
        <Table>
          <THead>
            <Th>SKU</Th>
            <Th>Item</Th>
            <Th numeric>On hand</Th>
            <Th numeric>Reorder point</Th>
            <Th numeric>Suggested qty</Th>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={5}>
                {rows.length === 0 ? "Every item is above its reorder point." : "No items match your search."}
              </EmptyRow>
            ) : (
              filtered.map((row) => (
                <Tr key={row.itemId}>
                  <Td className="tabular text-ink-soft">{row.sku}</Td>
                  <Td>
                    <span className="text-ink">{row.name}</span>
                    {row.isWeatherSensitive ? (
                      <span
                        title="Weather-sensitive — extra buffer during rainy season"
                        className="ml-2 inline-flex items-center rounded border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-muted"
                      >
                        WX
                      </span>
                    ) : null}
                  </Td>
                  <Td numeric className="text-alert">
                    {formatQty(row.totalOnHand)} {uomLabel(row.uom)}
                  </Td>
                  <Td numeric muted>{formatQty(row.reorderPoint)}</Td>
                  <Td numeric muted>{formatQty(row.reorderQty)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}
