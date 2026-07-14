"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";

/**
 * Hard-delete an item. The server refuses (409) if the item has any stock, sales
 * or documents — that message is shown as-is, steering the user to Inactive.
 */
export function ItemDeleteButton({ itemId, sku }: { itemId: string; sku: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        `Delete ${sku}? This cannot be undone. An item that has any stock or history cannot be deleted — deactivate it instead.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await api.del(`/api/items/${itemId}`);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${sku} deleted.`);
    router.push("/items");
  }

  return (
    <div>
      <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
        <Trash2 className="size-4" /> {busy ? "Deleting…" : "Delete item"}
      </Button>
    </div>
  );
}
