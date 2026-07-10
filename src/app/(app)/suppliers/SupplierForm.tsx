"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import type { SupplierRow } from "./SuppliersTable";

const VAT_STATUSES = ["VAT_REGISTERED", "NON_VAT", "EXEMPT"] as const;

interface SupplierFormState {
  code: string;
  name: string;
  tin: string;
  vatStatus: string;
  ewtApplicable: boolean;
  ewtRate: string;
  atcCode: string;
  leadTimeDays: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

const EMPTY_FORM: SupplierFormState = {
  code: "",
  name: "",
  tin: "",
  vatStatus: "VAT_REGISTERED",
  ewtApplicable: true,
  ewtRate: "0.0100",
  atcCode: "WC158",
  leadTimeDays: "7",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
};

function toFormState(s: SupplierRow): SupplierFormState {
  return {
    code: s.code,
    name: s.name,
    tin: s.tin ?? "",
    vatStatus: s.vatStatus,
    ewtApplicable: s.ewtApplicable,
    ewtRate: s.ewtRate,
    atcCode: s.atcCode,
    leadTimeDays: String(s.leadTimeDays),
    contactPerson: s.contactPerson ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    address: s.address ?? "",
  };
}

interface SupplierFormProps {
  mode: "create" | "edit";
  supplier?: SupplierRow;
  /** Called after a successful edit save or cancel, so the table can close the inline row. */
  onDone?: () => void;
}

export function SupplierForm({ mode, supplier, onDone }: SupplierFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "edit");
  const [form, setForm] = useState<SupplierFormState>(supplier ? toFormState(supplier) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Create omits empty optional fields; edit clears them with null. */
  function setOptional(body: Record<string, unknown>, key: string, value: string) {
    const v = value.trim();
    if (v) body[key] = v;
    else if (mode === "edit") body[key] = null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const body: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      vatStatus: form.vatStatus,
      ewtApplicable: form.ewtApplicable,
      ewtRate: form.ewtRate,
      atcCode: form.atcCode.trim(),
      leadTimeDays: Number(form.leadTimeDays),
    };
    setOptional(body, "tin", form.tin);
    setOptional(body, "contactPerson", form.contactPerson);
    setOptional(body, "email", form.email);
    setOptional(body, "phone", form.phone);
    setOptional(body, "address", form.address);

    const result =
      mode === "create"
        ? await api.post("/api/suppliers", body)
        : await api.patch(`/api/suppliers/${supplier!.id}`, body);

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
        <Field label="TIN" htmlFor={`${mode}-tin`} hint="000-000-000 or with branch code">
          <Input id={`${mode}-tin`} value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} />
        </Field>
        <Field label="VAT status" htmlFor={`${mode}-vatStatus`} required>
          <Select
            id={`${mode}-vatStatus`}
            value={form.vatStatus}
            onChange={(e) => setForm({ ...form, vatStatus: e.target.value })}
            required
          >
            {VAT_STATUSES.map((v) => (
              <option key={v} value={v}>
                {v.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ATC code" htmlFor={`${mode}-atcCode`}>
          <Input
            id={`${mode}-atcCode`}
            value={form.atcCode}
            onChange={(e) => setForm({ ...form, atcCode: e.target.value })}
          />
        </Field>
        <Field label="EWT rate" htmlFor={`${mode}-ewtRate`} hint="Fraction, e.g. 0.0100 = 1%">
          <Input
            id={`${mode}-ewtRate`}
            type="number"
            min="0"
            max="1"
            step="0.0001"
            value={form.ewtRate}
            onChange={(e) => setForm({ ...form, ewtRate: e.target.value })}
            disabled={!form.ewtApplicable}
          />
        </Field>
        <Field label="Lead time (days)" htmlFor={`${mode}-leadTimeDays`} required>
          <Input
            id={`${mode}-leadTimeDays`}
            type="number"
            min="0"
            step="1"
            value={form.leadTimeDays}
            onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
            required
          />
        </Field>
        <Field label="Contact person" htmlFor={`${mode}-contactPerson`}>
          <Input
            id={`${mode}-contactPerson`}
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor={`${mode}-email`}>
          <Input
            id={`${mode}-email`}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone" htmlFor={`${mode}-phone`}>
          <Input
            id={`${mode}-phone`}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Address" htmlFor={`${mode}-address`} className="lg:col-span-2">
          <Input
            id={`${mode}-address`}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={form.ewtApplicable}
          onChange={(e) => setForm({ ...form, ewtApplicable: e.target.checked })}
          className="size-4 rounded border-line-strong accent-ink"
        />
        Subject to expanded withholding tax
      </label>
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
          {pending ? "Saving…" : mode === "create" ? "Save supplier" : "Save changes"}
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New supplier</h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Plus className="size-4" /> New supplier
            </>
          )}
        </Button>
      </div>
      {open ? <div className="border-t border-line px-5 py-5">{fields}</div> : null}
    </section>
  );
}
