"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableWrap, THead, TBody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { SortableTh, nextSort, type SortDir } from "@/components/ui/SortableTh";
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

type SortKey =
  | "sku"
  | "name"
  | "warehouse"
  | "onHand"
  | "reserved"
  | "available"
  | "avgCost"
  | "lineValue";

function sortValue(r: StockRow, key: SortKey): string | number {
  switch (key) {
    case "sku": return r.sku;
    case "name": return r.name;
    case "warehouse": return r.warehouseName;
    case "onHand": return Number(r.qtyOnHand);
    case "reserved": return Number(r.qtyReserved);
    case "available": return Number(r.qtyOnHand) - Number(r.qtyReserved);
    case "avgCost": return Number(r.avgUnitCost);
    case "lineValue": return Number(r.qtyOnHand) * Number(r.avgUnitCost);
  }
}

export function StockTable({ rows, canCost }: StockTableProps) {
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const warehouses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.warehouseId)) seen.set(r.warehouseId, r.warehouseName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => rowMatches([r.sku, r.name, r.warehouseName], query));
    if (warehouseId) out = out.filter((r) => r.warehouseId === warehouseId);
    if (lowOnly) out = out.filter((r) => Number(r.qtyOnHand) <= Number(r.reorderPoint));
    if (sort) {
      const mul = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const va = sortValue(a, sort.key);
        const vb = sortValue(b, sort.key);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
        return String(va).localeCompare(String(vb)) * mul;
      });
    }
    return out;
  }, [rows, query, warehouseId, lowOnly, sort]);

  const colCount = canCost ? 8 : 6;
  const sortBtn = (key: SortKey, label: string, numeric?: boolean) => (
    <SortableTh
      label={label}
      numeric={numeric}
      active={sort?.key === key}
      dir={sort?.key === key ? sort.dir : "asc"}
      onSort={() => setSort((s) => nextSort(s, key))}
    />
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search SKU, item, warehouse…" />
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            aria-label="Filter by warehouse"
            className="h-9 rounded-input border border-line bg-surface px-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="">All warehouses</option>
            {warehouses.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              className="accent-ink"
            />
            Low stock only
          </label>
        </div>
        <p className="text-xs text-muted">
          {filtered.length} of {rows.length} stock lines
        </p>
      </div>
      <TableWrap>
        <Table>
          <THead>
            {sortBtn("sku", "SKU")}
            {sortBtn("name", "Item")}
            {sortBtn("warehouse", "Warehouse")}
            {sortBtn("onHand", "On hand", true)}
            {sortBtn("reserved", "Reserved", true)}
            {sortBtn("available", "Available", true)}
            {canCost ? sortBtn("avgCost", "Avg cost", true) : null}
            {canCost ? sortBtn("lineValue", "Line value", true) : null}
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
