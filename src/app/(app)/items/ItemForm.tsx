"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { UOM_LABELS } from "@/lib/ph";

interface CategoryOption {
  id: string;
  name: string;
}

const VAT_CLASSES = ["VATABLE", "ZERO_RATED", "EXEMPT"] as const;
const UOM_KEYS = Object.keys(UOM_LABELS) as (keyof typeof UOM_LABELS)[];

const EMPTY_FORM = {
  sku: "",
  name: "",
  categoryId: "",
  uom: "PC" as string,
  vatClass: "VATABLE" as string,
  standardCost: "0",
  reorderPoint: "0",
  reorderQty: "0",
  isWeatherSensitive: false,
};

export function ItemForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await api.post<{ id: string }>("/api/items", {
      sku: form.sku.trim(),
      name: form.name.trim(),
      categoryId: form.categoryId,
      uom: form.uom,
      vatClass: form.vatClass,
      standardCost: form.standardCost,
      reorderPoint: form.reorderPoint,
      reorderQty: form.reorderQty,
      isWeatherSensitive: form.isWeatherSensitive,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Go straight to the new item's page so photos can be added and any field
    // corrected right after creation.
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setOpen(false);
    router.push(`/items/${result.data.id}`);
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New item</h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Plus className="size-4" /> New item
            </>
          )}
        </Button>
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-line px-5 py-5">
          <FormError>{error}</FormError>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="SKU" htmlFor="sku" required>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                required
              />
            </Field>
            <Field label="Name" htmlFor="name" required className="lg:col-span-2">
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Category" htmlFor="categoryId" required>
              <Select
                id="categoryId"
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
            <Field label="Unit of measure" htmlFor="uom" required>
              <Select
                id="uom"
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
            <Field label="VAT class" htmlFor="vatClass" required>
              <Select
                id="vatClass"
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
            <Field label="Standard cost (PHP)" htmlFor="standardCost" required>
              <Input
                id="standardCost"
                type="number"
                min="0"
                step="0.01"
                value={form.standardCost}
                onChange={(e) => setForm({ ...form, standardCost: e.target.value })}
                required
              />
            </Field>
            <Field label="Reorder point" htmlFor="reorderPoint" required>
              <Input
                id="reorderPoint"
                type="number"
                min="0"
                step="0.001"
                value={form.reorderPoint}
                onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                required
              />
            </Field>
            <Field label="Reorder qty" htmlFor="reorderQty" required>
              <Input
                id="reorderQty"
                type="number"
                min="0"
                step="0.001"
                value={form.reorderQty}
                onChange={(e) => setForm({ ...form, reorderQty: e.target.value })}
                required
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save item"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
