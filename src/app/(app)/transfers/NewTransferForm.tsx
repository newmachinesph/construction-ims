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
  quantity: string;
}

function emptyLine(): LineRow {
  return { key: crypto.randomUUID(), itemId: "", quantity: "" };
}

interface NewTransferFormProps {
  warehouses: Option[];
  items: ItemOption[];
}

export function NewTransferForm({ warehouses, items }: NewTransferFormProps) {
  const router = useRouter();

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
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

    if (!fromWarehouseId || !toWarehouseId) {
      setError("Source and destination warehouses are required.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouses must differ.");
      return;
    }

    const validLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setError("Add at least one line with an item and quantity.");
      return;
    }

    setPending(true);
    const res = await api.post("/api/transfers", {
      fromWarehouseId,
      toWarehouseId,
      remarks: remarks.trim() || undefined,
      lines: validLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFromWarehouseId("");
    setToWarehouseId("");
    setRemarks("");
    setLines([emptyLine()]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New transfer</h2>
      <FormError>{error}</FormError>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="From warehouse" htmlFor="fromWarehouseId" required>
          <Select
            id="fromWarehouseId"
            value={fromWarehouseId}
            onChange={(e) => setFromWarehouseId(e.target.value)}
            required
          >
            <option value="">Select source…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="To warehouse" htmlFor="toWarehouseId" required>
          <Select id="toWarehouseId" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
            <option value="">Select destination…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
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

        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Quantity</Th>
              <Th />
            </THead>
            <TBody>
              {lines.length === 0 ? (
                <EmptyRow colSpan={3}>Add a line to get started.</EmptyRow>
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
                          min="0"
                          step="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                          className="text-right"
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
          {pending ? "Dispatching…" : "Dispatch transfer"}
        </Button>
      </div>
    </form>
  );
}
