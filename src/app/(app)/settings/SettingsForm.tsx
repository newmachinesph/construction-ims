"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, FormError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { api } from "@/components/ui/api";

interface SettingsFormProps {
  initial: {
    name: string;
    tin: string | null;
    address: string | null;
    pcabLicenseNo: string | null;
    vatRegistered: boolean;
    isTopWithholdingAgent: boolean;
  };
  canWrite: boolean;
}

export function SettingsForm({ initial, canWrite }: SettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial.name,
    tin: initial.tin ?? "",
    address: initial.address ?? "",
    pcabLicenseNo: initial.pcabLicenseNo ?? "",
    vatRegistered: initial.vatRegistered,
    isTopWithholdingAgent: initial.isTopWithholdingAgent,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setPending(true);

    const result = await api.patch("/api/settings", {
      name: form.name.trim(),
      tin: form.tin.trim() || undefined,
      address: form.address.trim() || undefined,
      pcabLicenseNo: form.pcabLicenseNo.trim() || undefined,
      vatRegistered: form.vatRegistered,
      isTopWithholdingAgent: form.isTopWithholdingAgent,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
      <FormError>{error}</FormError>
      {success ? <p className="text-sm text-ink">Settings saved.</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="name" required>
          <Input
            id="name"
            value={form.name}
            disabled={!canWrite}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <Field label="TIN" htmlFor="tin" hint="000-000-000 or with branch code">
          <Input
            id="tin"
            value={form.tin}
            disabled={!canWrite}
            onChange={(e) => setForm({ ...form, tin: e.target.value })}
          />
        </Field>
        <Field label="Address" htmlFor="address" className="sm:col-span-2">
          <Input
            id="address"
            value={form.address}
            disabled={!canWrite}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="PCAB license no." htmlFor="pcabLicenseNo">
          <Input
            id="pcabLicenseNo"
            value={form.pcabLicenseNo}
            disabled={!canWrite}
            onChange={(e) => setForm({ ...form, pcabLicenseNo: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.vatRegistered}
            disabled={!canWrite}
            onChange={(e) => setForm({ ...form, vatRegistered: e.target.checked })}
            className="accent-ink"
          />
          VAT registered
        </label>
        <div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isTopWithholdingAgent}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, isTopWithholdingAgent: e.target.checked })}
              className="accent-ink"
            />
            Top Withholding Agent
          </label>
          <p className="mt-1 pl-6 text-xs text-muted">
            When enabled, EWT is withheld on supplier purchases.
          </p>
        </div>
      </div>

      {canWrite ? (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
