"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import type { WarehouseRow } from "./WarehousesTable";

export interface ProjectOption {
  id: string;
  name: string;
}

const KINDS = ["MAIN_WAREHOUSE", "SITE_BODEGA"] as const;

interface WarehouseFormState {
  code: string;
  name: string;
  kind: string;
  projectId: string;
  address: string;
  isActive: boolean;
}

const EMPTY_FORM: WarehouseFormState = {
  code: "",
  name: "",
  kind: "MAIN_WAREHOUSE",
  projectId: "",
  address: "",
  isActive: true,
};

function toFormState(w: WarehouseRow): WarehouseFormState {
  return {
    code: w.code,
    name: w.name,
    kind: w.kind,
    projectId: w.projectId ?? "",
    address: w.address ?? "",
    isActive: w.isActive,
  };
}

interface WarehouseFormProps {
  projects: ProjectOption[];
  mode?: "create" | "edit";
  warehouse?: WarehouseRow;
  /** Called after a successful edit save or cancel, so the table can close the inline row. */
  onDone?: () => void;
}

export function WarehouseForm({ projects, mode = "create", warehouse, onDone }: WarehouseFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "edit");
  const [form, setForm] = useState<WarehouseFormState>(warehouse ? toFormState(warehouse) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const body: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      kind: form.kind,
    };
    if (mode === "edit") {
      // Edit sends every optional field so cleared values persist as null.
      body.projectId = form.projectId || null;
      body.address = form.address.trim() || null;
      body.isActive = form.isActive;
    } else {
      if (form.projectId) body.projectId = form.projectId;
      if (form.address.trim()) body.address = form.address.trim();
    }

    const result =
      mode === "create"
        ? await api.post("/api/warehouses", body)
        : await api.patch(`/api/warehouses/${warehouse!.id}`, body);

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (mode === "create") {
      setForm(EMPTY_FORM);
      setOpen(false);
    }
    onDone?.();
    router.refresh();
  }

  const fields = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError>{error}</FormError>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Code" htmlFor={`${mode}-code`} required>
          <Input
            id={`${mode}-code`}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
        </Field>
        <Field label="Name" htmlFor={`${mode}-name`} required className="lg:col-span-2">
          <Input
            id={`${mode}-name`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <Field label="Kind" htmlFor={`${mode}-kind`} required>
          <Select
            id={`${mode}-kind`}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            required
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "MAIN_WAREHOUSE" ? "Main warehouse" : "Site bodega"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor={`${mode}-projectId`} hint="Only relevant for a site bodega">
          <Select
            id={`${mode}-projectId`}
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          >
            <option value="">— none —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Address" htmlFor={`${mode}-address`} className="lg:col-span-2">
          <Input
            id={`${mode}-address`}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
      </div>
      {mode === "edit" ? (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="size-4 rounded border-line-strong accent-ink"
          />
          Active (uncheck to deactivate this warehouse)
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (mode === "edit") onDone?.();
            else setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Save warehouse" : "Save changes"}
        </Button>
      </div>
    </form>
  );

  if (mode === "edit") {
    return <div className="rounded-card border border-line-strong bg-surface p-5">{fields}</div>;
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New warehouse</h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Plus className="size-4" /> New warehouse
            </>
          )}
        </Button>
      </div>
      {open ? <div className="border-t border-line px-5 py-5">{fields}</div> : null}
    </section>
  );
}
