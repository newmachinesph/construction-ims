"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";

const OPTIONS = [
  {
    key: "transactions",
    label: "Transactions",
    desc: "Stock ledger + every PO, GRN, requisition, issuance, transfer, adjustment, sale and attachment. Document numbers restart at 1.",
  },
  { key: "catalog", label: "Catalogue", desc: "Items, categories, and custom units (built-in units are kept)." },
  { key: "partners", label: "Suppliers & customers", desc: "" },
  { key: "locations", label: "Warehouses & projects", desc: "" },
  { key: "auditLog", label: "Audit log", desc: "The change-history trail itself." },
] as const;

type ScopeKey = (typeof OPTIONS)[number]["key"];

/**
 * Admin-only "danger zone": erase selected data. User accounts, roles and
 * company settings are always kept (never sent, never touched server-side).
 */
export function ResetDataPanel() {
  const router = useRouter();
  const toast = useToast();
  const [scopes, setScopes] = useState<Record<ScopeKey, boolean>>({
    transactions: false,
    catalog: false,
    partners: false,
    locations: false,
    auditLog: false,
  });
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Master data is FK-referenced by transactions, so wiping any of it forces
  // transactions to be wiped too.
  const mastersChecked = scopes.catalog || scopes.partners || scopes.locations;
  const txChecked = scopes.transactions || mastersChecked;
  const anySelected = txChecked || scopes.auditLog;

  function toggle(key: ScopeKey) {
    setScopes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function run() {
    setError(null);
    if (!window.confirm("This permanently erases the selected data and cannot be undone. Continue?")) {
      return;
    }
    setBusy(true);
    const res = await api.post("/api/reset", { ...scopes, transactions: txChecked, confirm });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Data reset. User accounts were kept.");
    setScopes({ transactions: false, catalog: false, partners: false, locations: false, auditLog: false });
    setConfirm("");
    router.refresh();
  }

  return (
    <section className="rounded-card border border-alert/40 bg-alert/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5 text-alert" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-alert">Danger zone — reset data</h2>
      </div>
      <p className="mt-2 text-xs text-muted">
        Permanently erases the selected data. User accounts, roles, and company settings are always kept.
        This cannot be undone.
      </p>
      <FormError>{error}</FormError>

      <div className="mt-4 flex flex-col gap-2">
        {OPTIONS.map((o) => {
          const forced = o.key === "transactions" && mastersChecked;
          const checked = o.key === "transactions" ? txChecked : scopes[o.key];
          return (
            <label key={o.key} className="flex items-start gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-line-strong accent-ink"
                checked={checked}
                disabled={forced || busy}
                onChange={() => toggle(o.key)}
              />
              <span>
                <span className="text-ink">{o.label}</span>
                {forced ? <span className="ml-1 text-xs text-muted">(required by your selection)</span> : null}
                {o.desc ? <span className="block text-xs text-muted">{o.desc}</span> : null}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span>
            Type <span className="font-semibold text-ink">RESET</span> to confirm
          </span>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-40" placeholder="RESET" />
        </label>
        <Button variant="danger" disabled={busy || !anySelected || confirm !== "RESET"} onClick={run}>
          {busy ? "Erasing…" : "Erase selected data"}
        </Button>
      </div>
    </section>
  );
}
