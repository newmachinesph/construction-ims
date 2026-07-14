"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { EditableSelect } from "@/components/ui/EditableSelect";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";
import { createCategoryOption, createUomOption, type CategoryOption, type UomOption } from "./catalog";

const VAT_CLASSES = ["VATABLE", "ZERO_RATED", "EXEMPT"] as const;

interface CreateForm {
  sku: string;
  name: string;
  categoryId: string;
  uom: string;
  vatClass: string;
  standardCost: string;
  sellingPrice: string;
  reorderPoint: string;
  reorderQty: string;
  isWeatherSensitive: boolean;
}

function emptyForm(categories: CategoryOption[], uoms: UomOption[]): CreateForm {
  return {
    sku: "",
    name: "",
    categoryId: categories[0]?.id ?? "",
    uom: uoms.find((u) => u.code === "PC")?.code ?? uoms[0]?.code ?? "",
    vatClass: "VATABLE",
    standardCost: "0",
    sellingPrice: "0",
    reorderPoint: "0",
    reorderQty: "0",
    isWeatherSensitive: false,
  };
}

export function ItemForm({
  categories,
  uoms,
}: {
  categories: CategoryOption[];
  uoms: UomOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local copies so a category/unit added inline shows up immediately.
  const [cats, setCats] = useState(categories);
  const [units, setUnits] = useState(uoms);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<CreateForm>({ defaultValues: emptyForm(categories, uoms) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await api.post<{ id: string }>("/api/items", {
      ...values,
      sku: values.sku.trim(),
      name: values.name.trim(),
    });
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Item created");
    queryClient.invalidateQueries({ queryKey: ["items"] });
    reset(emptyForm(cats, units));
    setOpen(false);
    // Go straight to the new item's page so photos can be added and any field
    // corrected right after creation.
    router.push(`/items/${result.data.id}`);
  });

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
        <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-line px-5 py-5">
          <FormError>{error}</FormError>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="SKU" htmlFor="sku" required>
              <Input id="sku" required {...register("sku")} />
            </Field>
            <Field label="Name" htmlFor="name" required className="lg:col-span-2">
              <Input id="name" required {...register("name")} />
            </Field>
            <Field label="Category" htmlFor="categoryId" hint="＋ to add a new one" required>
              <EditableSelect
                id="categoryId"
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
            <Field label="Unit of measure" htmlFor="uom" hint="＋ to add a new one" required>
              <EditableSelect
                id="uom"
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
            <Field label="VAT class" htmlFor="vatClass" required>
              <Select id="vatClass" required {...register("vatClass")}>
                {VAT_CLASSES.map((v) => (
                  <option key={v} value={v}>
                    {v.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cost (PHP)" htmlFor="standardCost" required>
              <Input id="standardCost" type="number" min="0" step="0.01" required {...register("standardCost")} />
            </Field>
            <Field label="SRP / Retail price (PHP)" htmlFor="sellingPrice" hint="VAT-exclusive. Default price at the counter.">
              <Input id="sellingPrice" type="number" min="0" step="0.01" {...register("sellingPrice")} />
            </Field>
            <Field label="Reorder point" htmlFor="reorderPoint" required>
              <Input id="reorderPoint" type="number" min="0" step="0.001" required {...register("reorderPoint")} />
            </Field>
            <Field label="Reorder qty" htmlFor="reorderQty" required>
              <Input id="reorderQty" type="number" min="0" step="0.001" required {...register("reorderQty")} />
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save item"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
