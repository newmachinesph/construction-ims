"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { EditableSelect } from "@/components/ui/EditableSelect";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";
import { createCategoryOption, createUomOption, type CategoryOption, type UomOption } from "./catalog";

export interface EditableItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  uom: string;
  vatClass: string;
  standardCost: string;
  sellingPrice: string;
  reorderPoint: string;
  reorderQty: string;
  dpwhPayItem: string | null;
  isWeatherSensitive: boolean;
  isActive: boolean;
}

interface EditForm {
  name: string;
  categoryId: string;
  uom: string;
  vatClass: string;
  standardCost: string;
  sellingPrice: string;
  reorderPoint: string;
  reorderQty: string;
  dpwhPayItem: string;
  isWeatherSensitive: boolean;
  isActive: boolean;
}

const VAT_CLASSES = ["VATABLE", "ZERO_RATED", "EXEMPT"] as const;

/**
 * Edit an existing item (PATCH /api/items/[id]). Rendered on the item detail
 * page for anyone with item:write. SKU is immutable (it is the natural key), so
 * it is shown read-only. Includes an Active toggle to deactivate an item
 * without deleting its ledger history.
 */
export function ItemEditForm({
  item,
  categories,
  uoms,
}: {
  item: EditableItem;
  categories: CategoryOption[];
  uoms: UomOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cats, setCats] = useState(categories);
  const [units, setUnits] = useState(uoms);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<EditForm>({
    defaultValues: {
      name: item.name,
      categoryId: item.categoryId,
      uom: item.uom,
      vatClass: item.vatClass,
      standardCost: item.standardCost,
      sellingPrice: item.sellingPrice,
      reorderPoint: item.reorderPoint,
      reorderQty: item.reorderQty,
      dpwhPayItem: item.dpwhPayItem ?? "",
      isWeatherSensitive: item.isWeatherSensitive,
      isActive: item.isActive,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await api.patch(`/api/items/${item.id}`, {
      ...values,
      name: values.name.trim(),
      dpwhPayItem: values.dpwhPayItem.trim() ? values.dpwhPayItem.trim() : null,
    });
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Item updated");
    setOpen(false);
    router.refresh();
    queryClient.invalidateQueries({ queryKey: ["items"] });
  });

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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-line px-5 py-5">
        <FormError>{error}</FormError>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" htmlFor="e-name" required className="lg:col-span-2">
            <Input id="e-name" required {...register("name")} />
          </Field>
          <Field label="Category" htmlFor="e-categoryId" required>
            <EditableSelect
              id="e-categoryId"
              required
              value={watch("categoryId")}
              onChange={(v) => setValue("categoryId", v)}
              options={cats.map((c) => ({ value: c.id, label: c.name }))}
              newLabel="New category"
              placeholder="e.g. Power Tools"
              onCreate={async (name) => {
                const opt = await createCategoryOption(name);
                setCats((prev) => [...prev, { id: opt.value, name: opt.label }]);
                return opt;
              }}
            />
          </Field>
          <Field label="Unit of measure" htmlFor="e-uom" required>
            <EditableSelect
              id="e-uom"
              required
              value={watch("uom")}
              onChange={(v) => setValue("uom", v)}
              options={units.map((u) => ({ value: u.code, label: u.label }))}
              newLabel="New unit"
              placeholder="e.g. drum"
              onCreate={async (name) => {
                const opt = await createUomOption(name);
                setUnits((prev) => [...prev, { code: opt.value, label: opt.label }]);
                return opt;
              }}
            />
          </Field>
          <Field label="VAT class" htmlFor="e-vatClass" required>
            <Select id="e-vatClass" required {...register("vatClass")}>
              {VAT_CLASSES.map((v) => (
                <option key={v} value={v}>
                  {v.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cost (PHP)" htmlFor="e-standardCost" required>
            <Input id="e-standardCost" type="number" min="0" step="0.01" required {...register("standardCost")} />
          </Field>
          <Field label="SRP / Retail price (PHP)" htmlFor="e-sellingPrice" hint="VAT-exclusive. Default price at the counter.">
            <Input id="e-sellingPrice" type="number" min="0" step="0.01" {...register("sellingPrice")} />
          </Field>
          <Field label="Reorder point" htmlFor="e-reorderPoint" required>
            <Input id="e-reorderPoint" type="number" min="0" step="0.001" required {...register("reorderPoint")} />
          </Field>
          <Field label="Reorder qty" htmlFor="e-reorderQty" required>
            <Input id="e-reorderQty" type="number" min="0" step="0.001" required {...register("reorderQty")} />
          </Field>
          <Field label="DPWH pay item" htmlFor="e-dpwh">
            <Input id="e-dpwh" {...register("dpwhPayItem")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="size-4 rounded border-line-strong accent-ink"
            {...register("isWeatherSensitive")}
          />
          Weather-sensitive (extra buffer stock in rainy season)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="size-4 rounded border-line-strong accent-ink"
            {...register("isActive")}
          />
          Active (uncheck to hide from new documents without deleting history)
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
