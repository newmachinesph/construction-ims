"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";

export function ReceiveTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReceive() {
    setError(null);
    setPending(true);
    const res = await api.post(`/api/transfers/${id}/receive`);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={handleReceive} disabled={pending}>
        {pending ? "Receiving…" : "Receive"}
      </Button>
      {error ? <p className="text-xs text-alert">{error}</p> : null}
    </div>
  );
}
