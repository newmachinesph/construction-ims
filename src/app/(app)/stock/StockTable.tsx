"use client";

import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { rowMatches } from "@/components/ui/cn";
import { formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";

interface StockRow {
  itemId: string;
  sku: string;
  name: string;
  uom: string;
  categoryId: string;
  reorderPoint: string;
  isWeatherSensitive: boolean;
  warehouseId: string;
  warehouseName: string;
  warehouseKind: string;
  qtyOnHand: string;
  qtyReserved: string;
  avgUnitCost: string;
}

interface StockTableProps {
  rows: StockRow[];
  canCost: boolean;
}

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export function StockTable({ rows, canCost }: StockTableProps) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) => rowMatches([r.sku, r.name, r.warehouseName], query));
  const colCount = canCost ? 8 : 6;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search SKU, item, warehouse…" />
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} stock lines
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <Th>SKU</Th>
            <Th>Item</Th>
            <Th>Warehouse</Th>
            <Th numeric>On hand</Th>
            <Th numeric>Reserved</Th>
            <Th numeric>Available</Th>
            {canCost ? <Th numeric>Avg cost</Th> : null}
            {canCost ? <Th numeric>Line value</Th> : null}
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={colCount}>No stock lines match your search.</EmptyRow>
            ) : (
              filtered.map((r) => {
                const onHand = Number(r.qtyOnHand);
                const reserved = Number(r.qtyReserved);
                const available = onHand - reserved;
                const lineValue = onHand * Number(r.avgUnitCost);
                const isLow = onHand <= Number(r.reorderPoint);
                return (
                  <Tr key={`${r.itemId}-${r.warehouseId}`}>
                    <Td className="tabular text-ink-soft">{r.sku}</Td>
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
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-soft">{r.warehouseName}</span>
                        <StatusBadge
                          tone="outline"
                          label={r.warehouseKind === "MAIN_WAREHOUSE" ? "MAIN" : "SITE"}
                          value={r.warehouseKind}
                        />
                      </div>
                    </Td>
                    <Td numeric className={isLow ? "text-alert" : undefined}>
                      {formatQty(onHand)} {uomLabel(r.uom)}
                    </Td>
                    <Td numeric muted>
                      {formatQty(reserved)}
                    </Td>
                    <Td numeric>{formatQty(available)}</Td>
                    {canCost ? <Td numeric muted>{formatPHP(r.avgUnitCost)}</Td> : null}
                    {canCost ? <Td numeric>{formatPHP(lineValue)}</Td> : null}
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
