"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td } from "@/components/ui/Table";
import { StatTile } from "@/components/ui/StatTile";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";

interface PreviewRow {
  line: number;
  sku: string;
  name: string;
  action: "create" | "skip-existing";
  errors: string[];
}
interface Preview {
  rows: PreviewRow[];
  toCreate: number;
  toSkip: number;
  newCategories: number;
  newUnits: number;
  errorCount: number;
}

/** Collapsible CSV mass-add for the item catalogue. Creates items only — no stock. */
export function ItemsImport() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setPreview(null);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setBusy(true);
    const result = await api.post<Preview>("/api/items/import", { csv: text, preview: true });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result.data);
  }

  async function commit() {
    setError(null);
    setBusy(true);
    const result = await api.post<{
      itemsCreated: number;
      skipped: number;
      newCategories: number;
      newUnits: number;
    }>("/api/items/import", { csv, preview: false });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    const { itemsCreated, skipped, newCategories, newUnits } = result.data;
    const extras = [
      skipped ? `${skipped} skipped (already exist)` : "",
      newCategories ? `${newCategories} new categor${newCategories === 1 ? "y" : "ies"}` : "",
      newUnits ? `${newUnits} new unit(s)` : "",
    ].filter(Boolean);
    toast.success(`${itemsCreated} item(s) added${extras.length ? ` — ${extras.join(", ")}` : ""}.`);
    setPreview(null);
    setCsv("");
    setFileName("");
    queryClient.invalidateQueries({ queryKey: ["items"] });
    router.refresh();
  }

  const canCommit = preview !== null && preview.errorCount === 0 && preview.toCreate > 0 && !busy;

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Bulk import (CSV)</h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Plus className="size-4" /> Import items
            </>
          )}
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-line px-5 py-5">
          <FormError>{error}</FormError>

          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/items/import/template" download>
              <Button variant="secondary" size="sm" type="button">
                <Download className="size-4" /> Download CSV template
              </Button>
            </a>

            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md bg-ink px-3 text-xs font-medium text-paper transition-colors hover:bg-ink-soft focus-within:ring-2 focus-within:ring-ink/30">
              <Upload className="size-4" />
              {fileName || "Choose CSV file"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>

            {busy ? <span className="text-xs text-muted">Checking…</span> : null}
            <p className="text-xs text-muted">Adds items only — it never moves stock.</p>
          </div>

          {preview ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <StatTile label="To create" value={preview.toCreate} hint="New items" />
                <StatTile label="Skipped" value={preview.toSkip} hint="SKU already exists" />
                <StatTile
                  label="Errors"
                  value={preview.errorCount}
                  alert={preview.errorCount > 0}
                  hint={preview.errorCount > 0 ? "Fix and re-upload" : "Ready"}
                />
              </div>

              {preview.newCategories + preview.newUnits > 0 ? (
                <p className="text-xs text-muted">
                  New categories/units in the file are created automatically:{" "}
                  <span className="text-ink-soft">
                    {preview.newCategories} categor{preview.newCategories === 1 ? "y" : "ies"}, {preview.newUnits}{" "}
                    unit(s)
                  </span>
                  .
                </p>
              ) : null}

              {preview.errorCount > 0 ? (
                <p className="rounded-card border border-alert px-4 py-3 text-sm text-alert" role="alert">
                  This file has {preview.errorCount} error(s). Nothing is imported until every row is
                  valid.
                </p>
              ) : null}

              <TableWrap>
                <Table>
                  <THead>
                    <Th>Row</Th>
                    <Th>SKU</Th>
                    <Th>Item</Th>
                    <Th>Action</Th>
                    <Th>Problems</Th>
                  </THead>
                  <TBody>
                    {preview.rows.map((r) => (
                      <Tr key={r.line}>
                        <Td muted className="tabular text-xs">{r.line}</Td>
                        <Td className="tabular text-ink-soft">{r.sku || "—"}</Td>
                        <Td>{r.name || "—"}</Td>
                        <Td muted className="text-xs">
                          {r.action === "create" ? "Create" : "Skip — exists"}
                        </Td>
                        <Td>
                          {r.errors.length > 0 ? (
                            <span className="text-xs text-alert">{r.errors.join("; ")}</span>
                          ) : (
                            <span className="text-xs text-muted">OK</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>

              <div className="flex justify-end">
                <Button onClick={commit} disabled={!canCommit}>
                  {busy ? "Importing…" : `Import ${preview.toCreate} item(s)`}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
