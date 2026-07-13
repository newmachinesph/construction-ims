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
    /** Stored 0-1 (0.1200); the form edits it as a percent. */
    vatRate: string;
    isTopWithholdingAgent: boolean;
    allowAdminSelfApproveAdjustment: boolean;
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
    vatRatePercent: String(Number(initial.vatRate) * 100),
    isTopWithholdingAgent: initial.isTopWithholdingAgent,
    allowAdminSelfApproveAdjustment: initial.allowAdminSelfApproveAdjustment,
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
      vatRatePercent: form.vatRatePercent === "" ? 0 : Number(form.vatRatePercent),
      isTopWithholdingAgent: form.isTopWithholdingAgent,
      allowAdminSelfApproveAdjustment: form.allowAdminSelfApproveAdjustment,
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
        <div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.vatRegistered}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, vatRegistered: e.target.checked })}
              className="accent-ink"
            />
            VAT registered — charge output VAT on sales
          </label>
          <p className="mt-1 pl-6 text-xs text-muted">
            Uncheck if the company is a non-VAT taxpayer. Sales then carry no output VAT and the
            invoice prints without a VAT line. This is a company setting — the cashier cannot
            switch VAT off at the till.
          </p>
        </div>

        {form.vatRegistered ? (
          <div className="pl-6">
            <Field
              label="Output VAT rate (%)"
              htmlFor="vatRatePercent"
              hint="Statutory PH rate is 12. Applies to VATABLE lines only."
              className="max-w-45"
            >
              <Input
                id="vatRatePercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.vatRatePercent}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, vatRatePercent: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

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

        <div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.allowAdminSelfApproveAdjustment}
              disabled={!canWrite}
              onChange={(e) =>
                setForm({ ...form, allowAdminSelfApproveAdjustment: e.target.checked })
              }
              className="accent-ink"
            />
            Let an administrator approve their own stock adjustments
          </label>
          <p className="mt-1 pl-6 text-xs text-muted">
            For single-admin setups. When enabled, an Administrator can approve a stock
            adjustment they created themselves — including a CSV stock import — instead of
            needing a second approver. Leave this off if more than one person operates the
            system: normally the person who raises an adjustment cannot also approve it, to
            prevent one person writing off stock unwitnessed.
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
