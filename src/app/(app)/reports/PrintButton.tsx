"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Triggers the browser print dialog; the page's own @media print rule hides chrome.
 * Choosing "Save as PDF" as the destination downloads a paginated PDF — which is
 * why there is no PDF library here.
 */
export function PrintButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      title="Print, or choose 'Save as PDF' as the destination to download"
      onClick={() => window.print()}
    >
      <Printer className="size-4" /> Print / PDF
    </Button>
  );
}
