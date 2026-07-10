"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatQty, manilaToday, UOM_LABELS } from "@/lib/ph";

interface PoLineOption {
  id: string;
  qtyOrdered: string;
  qtyReceived: string;
  item: { sku: string; name: string; uom: string };
}

interface PoOption {
  id: string;
  poNumber: string;
  supplier: { name: string };
  lines: PoLineOption[];
}

interface LineValue {
  qtyReceived: string;
  qtyRejected: string;
}

function uomLabel(uom: string): string {
  return UOM_LABELS[uom as keyof typeof UOM_LABELS] ?? uom;
}

export function NewGrnForm({ pos }: { pos: PoOption[] }) {
  const router = useRouter();

  const [selectedPoId, setSelectedPoId] = useState("");
  const [lineValues, setLineValues] = useState<Record<string, LineValue>>({});
  const [receivedDate, setReceivedDate] = useState(manilaToday());
  const [supplierDrNumber, setSupplierDrNumber] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPo = pos.find((p) => p.id === selectedPoId) ?? null;
  const openLines = selectedPo
    ? selectedPo.lines.filter((l) => Number(l.qtyReceived) < Number(l.qtyOrdered))
    : [];

  function handleSelectPo(poId: string) {
    setSelectedPoId(poId);
    const po = pos.find((p) => p.id === poId);
    const open = po ? po.lines.filter((l) => Number(l.qtyReceived) < Number(l.qtyOrdered)) : [];
    const initial: Record<string, LineValue> = {};
    for (const l of open) {
      // toFixed(3) avoids floating-point epsilon (e.g. 10.1 - 5.05) tripping the
      // server's up-to-3-decimal-places quantity regex.
      const remaining = (Number(l.qtyOrdered) - Number(l.qtyReceived)).toFixed(3);
      initial[l.id] = { qtyReceived: remaining, qtyRejected: "0" };
    }
    setLineValues(initial);
  }

  function updateLineValue(poItemId: string, patch: Partial<LineValue>) {
    setLineValues((prev) => ({ ...prev, [poItemId]: { ...prev[poItemId], ...patch } }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedPoId) {
      setError("Select a purchase order.");
      return;
    }
    if (!receivedDate) {
      setError("Received date is required.");
      return;
    }

    const submittableLines = openLines
      .map((l) => ({ poItemId: l.id, ...(lineValues[l.id] ?? { qtyReceived: "0", qtyRejected: "0" }) }))
      .filter((l) => Number(l.qtyReceived) > 0);

    if (submittableLines.length === 0) {
      setError("Enter a received quantity for at least one line.");
      return;
    }

    setPending(true);
    const res = await api.post("/api/goods-receipts", {
      poId: selectedPoId,
      supplierDrNumber: supplierDrNumber.trim() || undefined,
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      supplierInvoiceDate: supplierInvoiceDate || null,
      receivedDate,
      remarks: remarks.trim() || undefined,
      lines: submittableLines,
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/goods-receipts");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError>{error}</FormError>

      <section className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Purchase order" htmlFor="poId" required className="sm:col-span-2 lg:col-span-3">
          <Select id="poId" value={selectedPoId} onChange={(e) => handleSelectPo(e.target.value)} required>
            <option value="">Select purchase order…</option>
            {pos.map((po) => (
              <option key={po.id} value={po.id}>
                {po.poNumber} — {po.supplier.name}
              </option>
            ))}
          </Select>
          {pos.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No approved purchase orders are awaiting delivery.</p>
          ) : null}
        </Field>

        <Field label="Received date" htmlFor="receivedDate" required>
          <Input
            id="receivedDate"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            required
          />
        </Field>

        <Field label="Supplier DR #" htmlFor="supplierDrNumber" hint="Optional">
          <Input
            id="supplierDrNumber"
            value={supplierDrNumber}
            onChange={(e) => setSupplierDrNumber(e.target.value)}
          />
        </Field>

        <Field label="Supplier invoice #" htmlFor="supplierInvoiceNumber" hint="Optional">
          <Input
            id="supplierInvoiceNumber"
            value={supplierInvoiceNumber}
            onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
          />
        </Field>

        <Field label="Supplier invoice date" htmlFor="supplierInvoiceDate" hint="Optional">
          <Input
            id="supplierInvoiceDate"
            type="date"
            value={supplierInvoiceDate}
            onChange={(e) => setSupplierInvoiceDate(e.target.value)}
          />
        </Field>

        <Field label="Remarks" htmlFor="remarks" hint="Optional" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </Field>
      </section>

      {selectedPo ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Open lines</h2>
          <TableWrap>
            <Table>
              <THead>
                <Th>Item</Th>
                <Th numeric>Ordered</Th>
                <Th numeric>Already received</Th>
                <Th numeric>Remaining</Th>
                <Th numeric>Qty received</Th>
                <Th numeric>Qty rejected</Th>
              </THead>
              <TBody>
                {openLines.length === 0 ? (
                  <EmptyRow colSpan={6}>This purchase order has no open lines.</EmptyRow>
                ) : (
                  openLines.map((line) => {
                    const remaining = Number(line.qtyOrdered) - Number(line.qtyReceived);
                    const value = lineValues[line.id] ?? { qtyReceived: "0", qtyRejected: "0" };
                    return (
                      <Tr key={line.id}>
                        <Td>
                          <span className="text-ink">{line.item.name}</span>{" "}
                          <span className="tabular text-xs text-muted">{line.item.sku}</span>
                        </Td>
                        <Td numeric muted>
                          {formatQty(line.qtyOrdered)} {uomLabel(line.item.uom)}
                        </Td>
                        <Td numeric muted>
                          {formatQty(line.qtyReceived)} {uomLabel(line.item.uom)}
                        </Td>
                        <Td numeric muted>
                          {formatQty(remaining)} {uomLabel(line.item.uom)}
                        </Td>
                        <Td numeric className="min-w-28">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={value.qtyReceived}
                            onChange={(e) => updateLineValue(line.id, { qtyReceived: e.target.value })}
                            className="text-right"
                          />
                        </Td>
                        <Td numeric className="min-w-28">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={value.qtyRejected}
                            onChange={(e) => updateLineValue(line.id, { qtyRejected: e.target.value })}
                            className="text-right"
                          />
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableWrap>
        </section>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push("/goods-receipts")}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !selectedPo}>
          {pending ? "Posting…" : "Post goods receipt"}
        </Button>
      </div>
    </form>
  );
}
