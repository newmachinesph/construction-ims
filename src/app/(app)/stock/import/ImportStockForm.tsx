"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, FormError } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td } from "@/components/ui/Table";
import { StatTile } from "@/components/ui/StatTile";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";
import { formatPHP, formatQty } from "@/lib/ph";

interface WarehouseOption {
  id: string;
  name: string;
}

interface PreviewRow {
  line: number;
  sku: string;
  name: string;
  quantity: string;
  unitCost: string;
  action: "create-item" | "existing-item";
  errors: string[];
}

interface Preview {
  rows: PreviewRow[];
  newItems: number;
  existingItems: number;
  totalQty: number;
  totalValue: number;
  errorCount: number;
}

export function ImportStockForm({ warehouses }: { warehouses: WarehouseOption[] }) {
  const router = useRouter();
  const toast = useToast();

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setPreview(null);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    await runPreview(text);
  }

  async function runPreview(text: string) {
    setBusy(true);
    const result = await api.post<Preview>("/api/stock/import", {
      csv: text,
      warehouseId,
      preview: true,
    });
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
    const result = await api.post<{ adjustmentId: string; adjustmentNumber: string; itemsCreated: number }>(
      "/api/stock/import",
      { csv, warehouseId, remarks, preview: false },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.data.adjustmentNumber} raised — ${result.data.itemsCreated} new item(s). It needs approval before stock moves.`,
    );
    router.push(`/adjustments/${result.data.adjustmentId}`);
  }

  const canCommit = preview !== null && preview.errorCount === 0 && !busy;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
        <FormError>{error}</FormError>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Warehouse" htmlFor="wh" required hint="Stock is loaded into this warehouse.">
            <Select
              id="wh"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPreview(null);
              }}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Remarks" htmlFor="remarks" hint="Shown on the adjustment.">
            <Input
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Opening balance, July 2026 count"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <a href="/api/stock/import/template" download>
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
        </div>
      </section>

      {preview ? (
        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="New items" value={preview.newItems} hint="Will be created" />
            <StatTile label="Existing items" value={preview.existingItems} hint="Stock topped up" />
            <StatTile label="Total qty" value={formatQty(preview.totalQty)} />
            <StatTile
              label="Errors"
              value={preview.errorCount}
              alert={preview.errorCount > 0}
              hint={preview.errorCount > 0 ? "Fix and re-upload" : "Ready to import"}
            />
          </div>

          {preview.errorCount > 0 ? (
            <p className="rounded-card border border-alert px-4 py-3 text-sm text-alert" role="alert">
              This file has {preview.errorCount} error(s). Nothing will be imported until every row is
              valid — a half-applied stock import is worse than a rejected one.
            </p>
          ) : (
            <p className="rounded-card border border-line bg-surface-2 px-4 py-3 text-sm text-ink-soft">
              Importing raises a <strong>draft stock adjustment</strong> worth{" "}
              <span className="tabular">{formatPHP(preview.totalValue)}</span>. Stock does not move
              until someone else approves it — you cannot approve your own.
            </p>
          )}

          <TableWrap>
            <Table>
              <THead>
                <Th>Row</Th>
                <Th>SKU</Th>
                <Th>Item</Th>
                <Th>Action</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Unit cost</Th>
                <Th>Problems</Th>
              </THead>
              <TBody>
                {preview.rows.map((r) => (
                  <Tr key={r.line}>
                    <Td muted className="tabular text-xs">{r.line}</Td>
                    <Td className="tabular text-ink-soft">{r.sku || "—"}</Td>
                    <Td>{r.name || "—"}</Td>
                    <Td muted className="text-xs">
                      {r.action === "create-item" ? "Create item" : "Existing"}
                    </Td>
                    <Td numeric>{r.quantity}</Td>
                    <Td numeric muted>{r.unitCost ? formatPHP(r.unitCost) : "—"}</Td>
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
              {busy ? "Importing…" : "Import — raise draft adjustment"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
