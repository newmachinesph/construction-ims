"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Triggers the browser print dialog; the page's own @media print rule hides chrome. */
export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer className="size-4" /> Print
    </Button>
  );
}
