"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { UOM_LABELS } from "@/lib/ph";

interface Option {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  sku: string;
  name: string;
  uom: string;
}

interface LineRow {
  key: string;
  itemId: string;
  qtyDelta: string;
  remarks: string;
}

const REASONS = ["COUNT_VARIANCE", "DAMAGE", "PILFERAGE", "SPOILAGE", "CORRECTION"] as const;

function emptyLine(): LineRow {
  return { key: crypto.randomUUID(), itemId: "", qtyDelta: "", remarks: "" };
}

interface NewAdjustmentFormProps {
  warehouses: Option[];
  items: ItemOption[];
}

export function NewAdjustmentForm({ warehouses, items }: NewAdjustmentFormProps) {
  const router = useRouter();

  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("COUNT_VARIANCE");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!warehouseId) {
      setError("Warehouse is required.");
      return;
    }

    const validLines = lines.filter((l) => l.itemId && Number(l.qtyDelta) !== 0 && l.qtyDelta.trim() !== "");
    if (validLines.length === 0) {
      setError("Add at least one line with an item and a non-zero quantity delta.");
      return;
    }

    setPending(true);
    const res = await api.post("/api/adjustments", {
      warehouseId,
      reason,
      remarks: remarks.trim() || undefined,
      lines: validLines.map((l) => ({
        itemId: l.itemId,
        qtyDelta: l.qtyDelta,
        remarks: l.remarks.trim() || undefined,
      })),
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setWarehouseId("");
    setReason("COUNT_VARIANCE");
    setRemarks("");
    setLines([emptyLine()]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New adjustment</h2>
      <FormError>{error}</FormError>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Warehouse" htmlFor="warehouseId" required>
          <Select id="warehouseId" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Reason" htmlFor="reason" required>
          <Select
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
            required
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Remarks" htmlFor="remarks" hint="Optional">
          <Input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Line items</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="size-3.5" />
            Add line
          </Button>
        </div>
        <p className="text-xs text-muted">Qty delta is signed — negative writes stock off.</p>

        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Qty delta</Th>
              <Th>Line remarks</Th>
              <Th />
            </THead>
            <TBody>
              {lines.length === 0 ? (
                <EmptyRow colSpan={4}>Add a line to get started.</EmptyRow>
              ) : (
                lines.map((line) => {
                  const item = items.find((i) => i.id === line.itemId);
                  return (
                    <Tr key={line.key}>
                      <Td className="min-w-48">
                        <Select value={line.itemId} onChange={(e) => updateLine(line.key, { itemId: e.target.value })}>
                          <option value="">Select item…</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.sku} — {i.name}
                            </option>
                          ))}
                        </Select>
                        {item ? (
                          <p className="mt-1 text-xs text-muted">
                            {UOM_LABELS[item.uom as keyof typeof UOM_LABELS] ?? item.uom}
                          </p>
                        ) : null}
                      </Td>
                      <Td numeric className="min-w-28">
                        <Input
                          type="number"
                          step="any"
                          value={line.qtyDelta}
                          onChange={(e) => updateLine(line.key, { qtyDelta: e.target.value })}
                          placeholder="e.g. -5 or 5"
                          className="text-right"
                        />
                      </Td>
                      <Td className="min-w-40">
                        <Input
                          value={line.remarks}
                          onChange={(e) => updateLine(line.key, { remarks: e.target.value })}
                          placeholder="Optional"
                        />
                      </Td>
                      <Td>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableWrap>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create adjustment"}
        </Button>
      </div>
    </form>
  );
}
