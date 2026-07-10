"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

interface PoActionsProps {
  id: string;
  status: string;
  canApprove: boolean;
  canCancel: boolean;
}

export function PoActions({ id, status, canApprove, canCancel }: PoActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");

  const showApprove = canApprove && (status === "DRAFT" || status === "PENDING_APPROVAL");
  const showCancel = canCancel && status !== "RECEIVED" && status !== "CANCELLED";

  if (!showApprove && !showCancel) return null;

  async function handleApprove() {
    setError(null);
    setPending("approve");
    const res = await api.post(`/api/purchase-orders/${id}/approve`);
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleCancel() {
    if (!reason.trim()) {
      setError("A cancellation reason is required.");
      return;
    }
    setError(null);
    setPending("cancel");
    const res = await api.post(`/api/purchase-orders/${id}/cancel`, { reason });
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowCancelForm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showApprove ? (
          <Button variant="primary" size="sm" onClick={handleApprove} disabled={pending !== null}>
            {pending === "approve" ? "Approving…" : "Approve"}
          </Button>
        ) : null}
        {showCancel ? (
          showCancelForm ? (
            <div className="flex items-center gap-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Cancellation reason"
                className="h-8 w-56 text-xs"
                autoFocus
              />
              <Button variant="danger" size="sm" onClick={handleCancel} disabled={pending !== null}>
                {pending === "cancel" ? "Cancelling…" : "Confirm cancel"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCancelForm(false);
                  setReason("");
                  setError(null);
                }}
              >
                Back
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setShowCancelForm(true)} disabled={pending !== null}>
              Cancel PO
            </Button>
          )
        ) : null}
      </div>
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}
