"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";

interface RoleOption {
  key: string;
  label: string;
}

const EMPTY_FORM = {
  email: "",
  fullName: "",
  role: "VIEWER",
  password: "",
};

export function NewUserForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await api.post("/api/users", {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      role: form.role,
      password: form.password,
    });
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New user</h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Plus className="size-4" /> New user
            </>
          )}
        </Button>
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-line px-5 py-5">
          <FormError>{error}</FormError>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" htmlFor="fullName" required>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </Field>
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Role" htmlFor="role" required>
              <Select
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                required
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Password" htmlFor="password" required>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Create user"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
