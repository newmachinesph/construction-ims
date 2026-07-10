"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";

interface ProjectOption {
  id: string;
  name: string;
}

const KINDS = ["MAIN_WAREHOUSE", "SITE_BODEGA"] as const;

const EMPTY_FORM = {
  code: "",
  name: "",
  kind: "MAIN_WAREHOUSE" as string,
  projectId: "",
  address: "",
};

export function WarehouseForm({ projects }: { projects: ProjectOption[] }) {
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
      kind: form.kind,
    };
    if (form.projectId) body.projectId = form.projectId;
    if (form.address.trim()) body.address = form.address.trim();

    const result = await api.post("/api/warehouses", body);
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
            <Field label="Kind" htmlFor="kind" required>
              <Select
                id="kind"
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
            <Field label="Project" htmlFor="projectId" hint="Only relevant for a site bodega">
              <Select
                id="projectId"
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
            <Field label="Address" htmlFor="address" className="lg:col-span-2">
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save warehouse"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
