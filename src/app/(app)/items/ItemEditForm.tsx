"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { UOM_LABELS } from "@/lib/ph";

interface CategoryOption {
  id: string;
  name: string;
}

export interface EditableItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  uom: string;
  vatClass: string;
  standardCost: string;
  reorderPoint: string;
  reorderQty: string;
  dpwhPayItem: string | null;
  isWeatherSensitive: boolean;
  isActive: boolean;
}

const VAT_CLASSES = ["VATABLE", "ZERO_RATED", "EXEMPT"] as const;
const UOM_KEYS = Object.keys(UOM_LABELS) as (keyof typeof UOM_LABELS)[];

/**
 * Edit an existing item (PATCH /api/items/[id]). Rendered on the item detail
 * page for anyone with item:write. SKU is immutable (it is the natural key), so
 * it is shown read-only. Includes an Active toggle to deactivate an item
 * without deleting its ledger history.
 */
export function ItemEditForm({
  item,
  categories,
}: {
  item: EditableItem;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(item);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await api.patch(`/api/items/${item.id}`, {
      name: form.name.trim(),
      categoryId: form.categoryId,
      uom: form.uom,
      vatClass: form.vatClass,
      standardCost: form.standardCost,
      reorderPoint: form.reorderPoint,
      reorderQty: form.reorderQty,
      dpwhPayItem: form.dpwhPayItem?.trim() ? form.dpwhPayItem.trim() : null,
      isWeatherSensitive: form.isWeatherSensitive,
      isActive: form.isActive,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Edit item
        </Button>
        {!item.isActive ? (
          <span className="inline-flex items-center rounded border border-line-strong px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-alert">
            Inactive
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Edit item</h2>
        <span className="tabular text-xs text-muted">{item.sku}</span>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-line px-5 py-5">
        <FormError>{error}</FormError>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" htmlFor="e-name" required className="lg:col-span-2">
            <Input
              id="e-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Category" htmlFor="e-categoryId" required>
            <Select
              id="e-categoryId"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unit of measure" htmlFor="e-uom" required>
            <Select
              id="e-uom"
              value={form.uom}
              onChange={(e) => setForm({ ...form, uom: e.target.value })}
              required
            >
              {UOM_KEYS.map((key) => (
                <option key={key} value={key}>
                  {UOM_LABELS[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="VAT class" htmlFor="e-vatClass" required>
            <Select
              id="e-vatClass"
              value={form.vatClass}
              onChange={(e) => setForm({ ...form, vatClass: e.target.value })}
              required
            >
              {VAT_CLASSES.map((v) => (
                <option key={v} value={v}>
                  {v.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Standard cost (PHP)" htmlFor="e-standardCost" required>
            <Input
              id="e-standardCost"
              type="number"
              min="0"
              step="0.01"
              value={form.standardCost}
              onChange={(e) => setForm({ ...form, standardCost: e.target.value })}
              required
            />
          </Field>
          <Field label="Reorder point" htmlFor="e-reorderPoint" required>
            <Input
              id="e-reorderPoint"
              type="number"
              min="0"
              step="0.001"
              value={form.reorderPoint}
              onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
              required
            />
          </Field>
          <Field label="Reorder qty" htmlFor="e-reorderQty" required>
            <Input
              id="e-reorderQty"
              type="number"
              min="0"
              step="0.001"
              value={form.reorderQty}
              onChange={(e) => setForm({ ...form, reorderQty: e.target.value })}
              required
            />
          </Field>
          <Field label="DPWH pay item" htmlFor="e-dpwh">
            <Input
              id="e-dpwh"
              value={form.dpwhPayItem ?? ""}
              onChange={(e) => setForm({ ...form, dpwhPayItem: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={form.isWeatherSensitive}
            onChange={(e) => setForm({ ...form, isWeatherSensitive: e.target.checked })}
            className="size-4 rounded border-line-strong accent-ink"
          />
          Weather-sensitive (extra buffer stock in rainy season)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="size-4 rounded border-line-strong accent-ink"
          />
          Active (uncheck to hide from new documents without deleting history)
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
