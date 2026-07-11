"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CustomerForm } from "./CustomerForm";

/** Collapsible "add customer" panel, matching the other master-data pages. */
export function NewCustomerPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <Button variant="secondary" size="sm" aria-expanded={false} onClick={() => setOpen(true)}>
          New customer
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New customer</h2>
        <Button variant="ghost" size="sm" aria-expanded onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <div className="border-t border-line px-5 py-5">
        <CustomerForm mode="create" onDone={() => setOpen(false)} />
      </div>
    </section>
  );
}
