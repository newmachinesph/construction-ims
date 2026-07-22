"use client";

import { useMemo, useState } from "react";
import { Input } from "./Field";

export interface PickItem {
  id: string;
  sku: string;
  name: string;
}

/**
 * Type-to-search item combobox — a searchable replacement for a plain <select>
 * when the catalogue is large (hundreds of SKUs). Filters by SKU or name and
 * calls onSelect with the chosen item's id (or "" while the user is retyping).
 */
export function ItemPicker({
  items,
  value,
  onSelect,
  id,
  placeholder = "Search SKU or name…",
}: {
  items: PickItem[];
  value: string;
  onSelect: (id: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const selected = items.find((i) => i.id === value);
  const [query, setQuery] = useState(selected ? `${selected.sku} — ${selected.name}` : "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter((i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
      : items;
    return pool.slice(0, 10);
  }, [query, items]);

  function pick(i: PickItem) {
    onSelect(i.id);
    setQuery(`${i.sku} — ${i.name}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onSelect(""); // a fresh search clears the stale selection
        }}
        // Delay so a click on an option registers before the list unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line-strong bg-surface shadow-lg">
          {matches.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-surface-2"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus; fire before onBlur closes the list
                  pick(i);
                }}
              >
                <span className="text-sm text-ink">{i.name}</span>
                <span className="tabular text-xs text-muted">{i.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
