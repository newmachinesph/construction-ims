"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";

export function ApproveAdjustmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setError(null);
    setPending(true);
    const res = await api.post(`/api/adjustments/${id}/approve`);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={handleApprove} disabled={pending}>
        {pending ? "Approving…" : "Approve"}
      </Button>
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}
