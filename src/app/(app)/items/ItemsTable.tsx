"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { SortableTh, nextSort, type SortDir } from "@/components/ui/SortableTh";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatPHP, formatQty } from "@/lib/ph";

const PAGE_SIZE = 25;

type SortKey = "sku" | "name" | "category" | "cost" | "srp" | "reorder";

interface ItemRow {
  id: string;
  sku: string;
  name: string;
  uom: string;
  standardCost: string;
  sellingPrice: string;
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

async function fetchItems(
  page: number,
  q: string,
  sort: { key: SortKey; dir: SortDir } | null,
  categoryId: string,
): Promise<ItemsPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  if (sort) {
    params.set("sort", sort.key);
    params.set("dir", sort.dir);
  }
  if (categoryId) params.set("categoryId", categoryId);
  const res = await fetch(`/api/items?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error ?? "Failed to load items.");
  return json.data as ItemsPage;
}

export function ItemsTable({
  categories,
  uoms,
}: {
  categories: { id: string; name: string }[];
  uoms: { code: string; label: string }[];
}) {
  const uomLabels = new Map(uoms.map((u) => [u.code, u.label]));
  const uomLabel = (code: string) => uomLabels.get(code) ?? code;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [categoryId, setCategoryId] = useState("");

  // Debounce the search box into `q`, and reset to page 1 on a new query.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["items", page, q, sort, categoryId],
    queryFn: () => fetchItems(page, q, sort, categoryId),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  const sortBtn = (key: SortKey, label: string, numeric?: boolean) => (
    <SortableTh
      label={label}
      numeric={numeric}
      active={sort?.key === key}
      dir={sort?.key === key ? sort.dir : "asc"}
      onSort={() => {
        setSort((s) => nextSort(s, key));
        setPage(1);
      }}
    />
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search SKU or name…" />
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="h-9 rounded-input border border-line bg-surface px-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {isFetching ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Updating…
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : isError ? (
        <div className="rounded-card border border-alert/40 bg-alert/5 px-4 py-10 text-center text-sm text-alert" role="alert">
          {error instanceof Error ? error.message : "Failed to load items."}
        </div>
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                {sortBtn("sku", "SKU")}
                {sortBtn("name", "Name")}
                {sortBtn("category", "Category")}
                <Th>UoM</Th>
                {sortBtn("cost", "Cost", true)}
                {sortBtn("srp", "SRP", true)}
                {sortBtn("reorder", "Reorder pt.", true)}
              </THead>
              <TBody>
                {rows.length === 0 ? (
                  <EmptyRow colSpan={7}>
                    {q || categoryId ? "No items match your search." : "No items yet."}
                  </EmptyRow>
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
                      <Td numeric muted>{formatPHP(r.standardCost)}</Td>
                      <Td numeric>
                        {Number(r.sellingPrice) > 0 ? (
                          formatPHP(r.sellingPrice)
                        ) : (
                          <span className="text-alert">Not set</span>
                        )}
                      </Td>
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
