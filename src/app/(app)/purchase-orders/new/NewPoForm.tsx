"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { VatClass } from "@/db/schema";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { computeTotals, formatPHP, manilaToday, UOM_LABELS } from "@/lib/ph";

interface Option {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  sku: string;
  name: string;
  uom: string;
  vatClass: VatClass;
  standardCost: string;
}

interface LineRow {
  key: string;
  itemId: string;
  qtyOrdered: string;
  unitPrice: string;
  vatClass: VatClass;
}

const VAT_CLASSES: VatClass[] = ["VATABLE", "ZERO_RATED", "EXEMPT"];

function emptyLine(): LineRow {
  return { key: crypto.randomUUID(), itemId: "", qtyOrdered: "", unitPrice: "", vatClass: "VATABLE" };
}

interface NewPoFormProps {
  suppliers: Option[];
  warehouses: Option[];
  projects: Option[];
  items: ItemOption[];
}

export function NewPoForm({ suppliers, warehouses, projects, items }: NewPoFormProps) {
  const router = useRouter();

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [orderDate, setOrderDate] = useState(manilaToday());
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleItemChange(key: string, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    updateLine(key, {
      itemId,
      unitPrice: item ? item.standardCost : "",
      vatClass: item ? item.vatClass : "VATABLE",
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  const totals = computeTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice || "0", quantity: l.qtyOrdered || "0", vatClass: l.vatClass })),
    { withholdEwt: false },
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supplierId || !warehouseId || !orderDate) {
      setError("Supplier, warehouse and order date are required.");
      return;
    }

    const validLines = lines.filter((l) => l.itemId && Number(l.qtyOrdered) > 0);
    if (validLines.length === 0) {
      setError("Add at least one line with an item and quantity.");
      return;
    }

    setPending(true);
    const res = await api.post("/api/purchase-orders", {
      supplierId,
      warehouseId,
      projectId: projectId || null,
      orderDate,
      expectedDate: expectedDate || null,
      notes: notes.trim() || undefined,
      lines: validLines.map((l) => ({
        itemId: l.itemId,
        qtyOrdered: l.qtyOrdered,
        unitPrice: l.unitPrice || "0",
        vatClass: l.vatClass,
      })),
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/purchase-orders");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError>{error}</FormError>

      <section className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Supplier" htmlFor="supplierId" required>
          <Select id="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

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

        <Field label="Project" htmlFor="projectId" hint="Optional">
          <Select id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— none —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Order date" htmlFor="orderDate" required>
          <Input
            id="orderDate"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            required
          />
        </Field>

        <Field label="Expected date" htmlFor="expectedDate" hint="Optional">
          <Input
            id="expectedDate"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </Field>

        <Field label="Notes" htmlFor="notes" className="sm:col-span-2 lg:col-span-4">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Line items</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="size-3.5" />
            Add line
          </Button>
        </div>

        <TableWrap>
          <Table>
            <THead>
              <Th>Item</Th>
              <Th numeric>Qty ordered</Th>
              <Th numeric>Unit price</Th>
              <Th>VAT class</Th>
              <Th numeric>Line total</Th>
              <Th />
            </THead>
            <TBody>
              {lines.length === 0 ? (
                <EmptyRow colSpan={6}>Add a line to get started.</EmptyRow>
              ) : (
                lines.map((line) => {
                  const item = items.find((i) => i.id === line.itemId);
                  const lineTotal = Number(line.unitPrice || "0") * Number(line.qtyOrdered || "0");
                  return (
                    <Tr key={line.key}>
                      <Td className="min-w-48">
                        <Select value={line.itemId} onChange={(e) => handleItemChange(line.key, e.target.value)}>
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
                          value={line.qtyOrdered}
                          onChange={(e) => updateLine(line.key, { qtyOrdered: e.target.value })}
                          className="text-right"
                        />
                      </Td>
                      <Td numeric className="min-w-28">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                          className="text-right"
                        />
                      </Td>
                      <Td className="min-w-36">
                        <Select
                          value={line.vatClass}
                          onChange={(e) => updateLine(line.key, { vatClass: e.target.value as VatClass })}
                        >
                          {VAT_CLASSES.map((vc) => (
                            <option key={vc} value={vc}>
                              {vc.replace(/_/g, " ")}
                            </option>
                          ))}
                        </Select>
                      </Td>
                      <Td numeric>{formatPHP(lineTotal)}</Td>
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
      </section>

      <section className="flex justify-end">
        <div className="flex w-full max-w-xs flex-col gap-2 rounded-card border border-line bg-surface p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="tabular text-ink">{formatPHP(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">VAT</span>
            <span className="tabular text-ink">{formatPHP(totals.vatAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line-strong pt-2">
            <span className="font-medium text-ink">Total</span>
            <span className="tabular text-lg font-semibold text-ink">{formatPHP(totals.total)}</span>
          </div>
          <p className="text-xs text-muted">EWT is computed on submit from supplier + company tax profile.</p>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push("/purchase-orders")}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create purchase order"}
        </Button>
      </div>
    </form>
  );
}
