"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";

/** Reject a DRAFT adjustment — cancels it, nothing posts. Optional reason. */
export function RejectAdjustmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReject() {
    const reason = window.prompt("Reject this adjustment? Optionally note why:");
    if (reason === null) return; // Cancel pressed
    setError(null);
    setPending(true);
    const res = await api.post(`/api/adjustments/${id}/reject`, { reason: reason.trim() || undefined });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="danger" size="sm" onClick={handleReject} disabled={pending}>
        {pending ? "Rejecting…" : "Reject"}
      </Button>
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}
