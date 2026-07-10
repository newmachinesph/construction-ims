"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatPHP, formatQty, UOM_LABELS } from "@/lib/ph";

const PAGE_SIZE = 25;

interface ItemRow {
  id: string;
  sku: string;
  name: string;
  uom: string;
  standardCost: string;
  reorderPoint: string;
  isWeatherSensitive: boolean;
  isActive: boolean;
  categoryName: string;
}

interface ItemsPage {
  rows: ItemRow[];
  total: number;
  page: number;
  pageSize: number;
}

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

async function fetchItems(page: number, q: string): Promise<ItemsPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  const res = await fetch(`/api/items?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error ?? "Failed to load items.");
  return json.data as ItemsPage;
}

export function ItemsTable() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box into `q`, and reset to page 1 on a new query.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["items", page, q],
    queryFn: () => fetchItems(page, q),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search SKU or name…" />
        {isFetching ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Updating…
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isError ? (
        <div className="rounded-card border border-alert/40 bg-alert/5 px-4 py-10 text-center text-sm text-alert" role="alert">
          {error instanceof Error ? error.message : "Failed to load items."}
        </div>
      ) : (
        <>
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
                {rows.length === 0 ? (
                  <EmptyRow colSpan={6}>{q ? "No items match your search." : "No items yet."}</EmptyRow>
                ) : (
                  rows.map((r) => (
                    <Tr key={r.id}>
                      <Td className="tabular">
                        <Link
                          href={`/items/${r.id}`}
                          className="text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                        >
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
                        {!r.isActive ? (
                          <span
                            title="Inactive — hidden from new documents"
                            className="ml-2 inline-flex items-center rounded border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-alert"
                          >
                            Inactive
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              {total > 0 ? `Showing ${from}–${to} of ${total}` : "0 items"}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
