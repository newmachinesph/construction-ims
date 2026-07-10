"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

interface MrActionsProps {
  id: string;
  status: string;
  canApprove: boolean;
}

export function MrActions({ id, status, canApprove }: MrActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");

  const showActions = canApprove && status === "SUBMITTED";
  if (!showActions) return null;

  async function handleApprove() {
    setError(null);
    setPending("approve");
    const res = await api.post(`/api/requisitions/${id}/approve`);
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setError(null);
    setPending("reject");
    const res = await api.post(`/api/requisitions/${id}/reject`, { reason });
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowRejectForm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="primary" size="sm" onClick={handleApprove} disabled={pending !== null}>
          {pending === "approve" ? "Approving…" : "Approve"}
        </Button>
        {showRejectForm ? (
          <div className="flex items-center gap-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Rejection reason"
              className="h-8 w-56 text-xs"
              autoFocus
            />
            <Button variant="danger" size="sm" onClick={handleReject} disabled={pending !== null}>
              {pending === "reject" ? "Rejecting…" : "Confirm reject"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRejectForm(false);
                setReason("");
                setError(null);
              }}
            >
              Back
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setShowRejectForm(true)} disabled={pending !== null}>
            Reject
          </Button>
        )}
      </div>
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}
