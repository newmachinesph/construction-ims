"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";

/**
 * Void a posted sale. The invoice is cancelled (never deleted — the BIR serial
 * stays consumed so the series remains gapless) and stock is restored.
 */
export function VoidSaleButton({ saleId, siNumber }: { saleId: string; siNumber: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const result = await api.post(`/api/sales/${saleId}/void`, { reason: reason.trim() });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`${siNumber} voided. Stock restored.`);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Void sale
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <FormError>{error}</FormError>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Reason for voiding this sale"
          placeholder="Reason for void"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-56"
        />
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" disabled={busy || reason.trim().length < 3} onClick={submit}>
          {busy ? "Voiding…" : "Confirm void"}
        </Button>
      </div>
    </div>
  );
}
