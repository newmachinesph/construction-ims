"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";

const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

const EMPTY_FORM = {
  code: "",
  name: "",
  clientName: "",
  location: "",
  status: "PLANNING" as string,
  startDate: "",
  targetEndDate: "",
  contractAmount: "",
};

export function ProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const body: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      status: form.status,
    };
    if (form.clientName.trim()) body.clientName = form.clientName.trim();
    if (form.location.trim()) body.location = form.location.trim();
    if (form.startDate) body.startDate = form.startDate;
    if (form.targetEndDate) body.targetEndDate = form.targetEndDate;
    if (form.contractAmount.trim()) body.contractAmount = form.contractAmount.trim();

    const result = await api.post("/api/projects", body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(EMPTY_FORM);
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New project</h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Plus className="size-4" /> New project
            </>
          )}
        </Button>
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-line px-5 py-5">
          <FormError>{error}</FormError>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Code" htmlFor="code" required>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
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
            <Field label="Client" htmlFor="clientName">
              <Input
                id="clientName"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
            </Field>
            <Field label="Location" htmlFor="location">
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
            <Field label="Status" htmlFor="status" required>
              <Select
                id="status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                required
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="startDate">
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="Target end date" htmlFor="targetEndDate">
              <Input
                id="targetEndDate"
                type="date"
                value={form.targetEndDate}
                onChange={(e) => setForm({ ...form, targetEndDate: e.target.value })}
              />
            </Field>
            <Field label="Contract amount (PHP)" htmlFor="contractAmount">
              <Input
                id="contractAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.contractAmount}
                onChange={(e) => setForm({ ...form, contractAmount: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save project"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
