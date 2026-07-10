"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import type { ProjectRow } from "./ProjectsTable";

const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

interface ProjectFormState {
  code: string;
  name: string;
  clientName: string;
  location: string;
  status: string;
  startDate: string;
  targetEndDate: string;
  contractAmount: string;
}

const EMPTY_FORM: ProjectFormState = {
  code: "",
  name: "",
  clientName: "",
  location: "",
  status: "PLANNING",
  startDate: "",
  targetEndDate: "",
  contractAmount: "",
};

function toFormState(p: ProjectRow): ProjectFormState {
  return {
    code: p.code,
    name: p.name,
    clientName: p.clientName ?? "",
    location: p.location ?? "",
    status: p.status,
    startDate: p.startDate ?? "",
    targetEndDate: p.targetEndDate ?? "",
    contractAmount: p.contractAmount ?? "",
  };
}

interface ProjectFormProps {
  mode?: "create" | "edit";
  project?: ProjectRow;
  /** Called after a successful edit save or cancel, so the table can close the inline row. */
  onDone?: () => void;
}

export function ProjectForm({ mode = "create", project, onDone }: ProjectFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "edit");
  const [form, setForm] = useState<ProjectFormState>(project ? toFormState(project) : EMPTY_FORM);
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
      status: form.status,
    };
    setOptional(body, "clientName", form.clientName);
    setOptional(body, "location", form.location);
    setOptional(body, "startDate", form.startDate);
    setOptional(body, "targetEndDate", form.targetEndDate);
    if (form.contractAmount.trim()) body.contractAmount = form.contractAmount.trim();

    const result =
      mode === "create"
        ? await api.post("/api/projects", body)
        : await api.patch(`/api/projects/${project!.id}`, body);

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
        <Field label="Client" htmlFor={`${mode}-clientName`}>
          <Input
            id={`${mode}-clientName`}
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          />
        </Field>
        <Field label="Location" htmlFor={`${mode}-location`}>
          <Input
            id={`${mode}-location`}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </Field>
        <Field label="Status" htmlFor={`${mode}-status`} required>
          <Select
            id={`${mode}-status`}
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
        <Field label="Start date" htmlFor={`${mode}-startDate`}>
          <Input
            id={`${mode}-startDate`}
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </Field>
        <Field label="Target end date" htmlFor={`${mode}-targetEndDate`}>
          <Input
            id={`${mode}-targetEndDate`}
            type="date"
            value={form.targetEndDate}
            onChange={(e) => setForm({ ...form, targetEndDate: e.target.value })}
          />
        </Field>
        <Field label="Contract amount (PHP)" htmlFor={`${mode}-contractAmount`}>
          <Input
            id={`${mode}-contractAmount`}
            type="number"
            min="0"
            step="0.01"
            value={form.contractAmount}
            onChange={(e) => setForm({ ...form, contractAmount: e.target.value })}
          />
        </Field>
      </div>
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
          {pending ? "Saving…" : mode === "create" ? "Save project" : "Save changes"}
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
      {open ? <div className="border-t border-line px-5 py-5">{fields}</div> : null}
    </section>
  );
}
