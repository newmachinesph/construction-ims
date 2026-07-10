"use client";

import { Download } from "lucide-react";
import { Button } from "./Button";
import { toCsv, type CsvColumn } from "@/lib/csv";

interface Props<T extends Record<string, unknown>> {
  /** Filename without extension; a .csv is appended. */
  filename: string;
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
  label?: string;
}

/**
 * Download the given rows as a CSV. Data is already on the client (passed from
 * a server component), so the export is instant and needs no round trip.
 */
export function ExportCsvButton<T extends Record<string, unknown>>({
  filename,
  rows,
  columns,
  label = "Export CSV",
}: Props<T>) {
  function download() {
    const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    // Defer revoke: revoking synchronously can cut off the download read for
    // large CSVs in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <Button variant="secondary" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download className="size-4" /> {label}
    </Button>
  );
}
