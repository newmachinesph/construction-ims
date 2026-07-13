"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Th } from "./Table";

export type SortDir = "asc" | "desc";

/** Cycle a sort state: new column → asc, same column asc → desc, desc → asc. */
export function nextSort<K extends string>(
  current: { key: K; dir: SortDir } | null,
  key: K,
): { key: K; dir: SortDir } {
  if (current?.key === key && current.dir === "asc") return { key, dir: "desc" };
  return { key, dir: "asc" };
}

export function SortableTh({
  label,
  active,
  dir,
  numeric,
  onSort,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  numeric?: boolean;
  onSort: () => void;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Th numeric={numeric} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={onSort}
        className={
          "inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink " +
          (numeric ? "flex-row-reverse " : "") +
          (active ? "text-ink" : "")
        }
      >
        {label}
        <Icon className={"size-3 shrink-0 " + (active ? "" : "opacity-40")} />
      </button>
    </Th>
  );
}
